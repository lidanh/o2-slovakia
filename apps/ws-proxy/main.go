package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

func init() {
	// Load env files for local development (best-effort, ignored in production)
	godotenv.Load("../web/.env.local", ".env")
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		allowed := os.Getenv("ALLOWED_ORIGIN")
		if allowed == "" {
			return true
		}
		return r.Header.Get("Origin") == allowed
	},
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/ws", handleWS)

	log.Printf("[ws-proxy] listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "OK")
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	// 1. Origin check
	allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
	if allowedOrigin != "" && r.Header.Get("Origin") != allowedOrigin {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// 2. Parse query params
	token := r.URL.Query().Get("token")
	agentID := r.URL.Query().Get("agent_id")
	metadata := r.URL.Query().Get("metadata")

	if token == "" || agentID == "" {
		http.Error(w, "missing token or agent_id", http.StatusBadRequest)
		return
	}

	// 3. Validate JWT
	secret := os.Getenv("BROWSER_CALL_JWT_SECRET")
	parsed, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil || !parsed.Valid {
		log.Printf("[ws-proxy] invalid JWT: %v", err)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		http.Error(w, "invalid claims", http.StatusUnauthorized)
		return
	}

	sessionID, _ := claims["sessionId"].(string)
	if sessionID == "" {
		http.Error(w, "missing sessionId in token", http.StatusUnauthorized)
		return
	}

	supabaseURL := os.Getenv("SUPABASE_URL")
	if supabaseURL == "" {
		supabaseURL = os.Getenv("NEXT_PUBLIC_SUPABASE_URL")
	}
	serviceKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	// 4a. Verify session is active
	sessURL := fmt.Sprintf("%s/rest/v1/training_sessions?id=eq.%s&status=in.(initiated,in_progress)&select=id,tenant_id&limit=1",
		supabaseURL, url.QueryEscape(sessionID))
	sessResp, err := supabaseGet(sessURL, serviceKey)
	if err != nil {
		log.Printf("[ws-proxy] session check failed: %v", err)
		http.Error(w, "session check failed", http.StatusBadGateway)
		return
	}

	var sessions []struct {
		ID       string `json:"id"`
		TenantID string `json:"tenant_id"`
	}
	if err := json.Unmarshal(sessResp, &sessions); err != nil || len(sessions) == 0 {
		log.Printf("[ws-proxy] no active session found for %s", sessionID)
		http.Error(w, "no active session", http.StatusForbidden)
		return
	}

	tenantID := sessions[0].TenantID
	if tenantID == "" {
		log.Printf("[ws-proxy] session %s has no tenant_id", sessionID)
		http.Error(w, "session missing tenant", http.StatusInternalServerError)
		return
	}

	// 4b. Fetch tenant settings (wonderful config)
	cfgURL := fmt.Sprintf("%s/rest/v1/tenants?id=eq.%s&select=settings&limit=1",
		supabaseURL, url.QueryEscape(tenantID))
	cfgResp, err := supabaseGet(cfgURL, serviceKey)
	if err != nil {
		log.Printf("[ws-proxy] tenant settings fetch failed: %v", err)
		http.Error(w, "config fetch failed", http.StatusBadGateway)
		return
	}

	var cfgRows []struct {
		Settings struct {
			Wonderful struct {
				APIKey    string `json:"api_key"`
				TenantURL string `json:"tenant_url"`
			} `json:"wonderful"`
		} `json:"settings"`
	}
	if err := json.Unmarshal(cfgResp, &cfgRows); err != nil || len(cfgRows) == 0 {
		log.Printf("[ws-proxy] failed to parse tenant settings: %v", err)
		http.Error(w, "config parse failed", http.StatusInternalServerError)
		return
	}

	apiKey := cfgRows[0].Settings.Wonderful.APIKey
	tenantURL := cfgRows[0].Settings.Wonderful.TenantURL

	// 5. Extract origin from tenant_url
	parsed2, err := url.Parse(tenantURL)
	if err != nil {
		log.Printf("[ws-proxy] invalid tenant_url: %v", err)
		http.Error(w, "invalid tenant_url", http.StatusInternalServerError)
		return
	}
	host := parsed2.Host

	// 6. Build upstream URL
	upstreamURL := fmt.Sprintf("wss://%s/telephony/websocket/call?agent_id=%s", host, url.QueryEscape(agentID))
	if metadata != "" {
		upstreamURL += "&metadata=" + url.QueryEscape(metadata)
	}

	// 7. Connect to upstream
	reqHeader := http.Header{}
	reqHeader.Set("X-API-Key", apiKey)

	upstreamConn, resp, err := websocket.DefaultDialer.Dial(upstreamURL, reqHeader)
	if err != nil {
		body := ""
		if resp != nil && resp.Body != nil {
			b, _ := io.ReadAll(resp.Body)
			body = string(b)
			resp.Body.Close()
		}
		log.Printf("[ws-proxy] upstream dial failed: %v %s", err, body)
		http.Error(w, "upstream connection failed", http.StatusBadGateway)
		return
	}
	defer upstreamConn.Close()

	// 8. Upgrade client connection
	clientConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[ws-proxy] client upgrade failed: %v", err)
		return
	}
	defer clientConn.Close()

	log.Printf("[ws-proxy] relay established for session %s", sessionID)

	// 9. Relay messages bidirectionally
	done := make(chan struct{})

	// client -> upstream
	go func() {
		defer close(done)
		relay(clientConn, upstreamConn, "client->upstream")
	}()

	// upstream -> client
	relay(upstreamConn, clientConn, "upstream->client")

	<-done
	log.Printf("[ws-proxy] relay closed for session %s", sessionID)
}

func relay(src, dst *websocket.Conn, label string) {
	for {
		msgType, msg, err := src.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("[ws-proxy] %s closed normally", label)
			} else if !strings.Contains(err.Error(), "use of closed network connection") {
				log.Printf("[ws-proxy] %s read error: %v", label, err)
			}
			// Close the other side with the same close code if possible
			closeMsg := websocket.FormatCloseMessage(websocket.CloseNormalClosure, "")
			if ce, ok := err.(*websocket.CloseError); ok {
				closeMsg = websocket.FormatCloseMessage(ce.Code, ce.Text)
			}
			dst.WriteMessage(websocket.CloseMessage, closeMsg)
			return
		}
		if err := dst.WriteMessage(msgType, msg); err != nil {
			log.Printf("[ws-proxy] %s write error: %v", label, err)
			return
		}
	}
}

func supabaseGet(reqURL, serviceKey string) ([]byte, error) {
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase returned %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}
