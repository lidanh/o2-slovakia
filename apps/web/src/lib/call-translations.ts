export type CallLocale = "en" | "sk" | "hu";

const translations: Record<CallLocale, Record<string, string>> = {
  en: {
    outOf100: "out of 100",
    howToImprove: "How to improve",
    strengthNoted: "{count} strength noted",
    strengthsNoted: "{count} strengths noted",
    areaToImprove: "{count} area to improve",
    areasToImprove: "{count} areas to improve",
    fullFeedback: "Full feedback available in your dashboard",
    analyzing: "Analyzing your performance",
    aiReviewing: "Our AI is reviewing your conversation...",
    sessionCompleted: "Session Completed",
    validating: "Validating session...",
    requestNewLink: "Please request a new link from your administrator.",
    pressStart: "Press Start to begin your session",
    allowMic: "Allow microphone access...",
    connecting: "Connecting to agent...",
    startSession: "Start Session",
    endSession: "End Session",
    tellCode: "Tell this code to the agent",
    feedbackInDashboard:
      "Your training session has been recorded. Feedback will be available in your dashboard.",
    listening: "Listening...",
    agentSpeaking: "Agent speaking...",
  },
  sk: {
    outOf100: "zo 100",
    howToImprove: "Ako sa zlepšiť",
    strengthNoted: "{count} silná stránka",
    strengthsNoted: "{count} silné stránky",
    areaToImprove: "{count} oblasť na zlepšenie",
    areasToImprove: "{count} oblasti na zlepšenie",
    fullFeedback: "Kompletná spätná väzba je dostupná vo vašom dashboarde",
    analyzing: "Analyzujeme váš výkon",
    aiReviewing: "Naša AI analyzuje váš rozhovor...",
    sessionCompleted: "Relácia dokončená",
    validating: "Overovanie relácie...",
    requestNewLink: "Požiadajte svojho administrátora o nový odkaz.",
    pressStart: "Stlačte Štart pre začatie relácie",
    allowMic: "Povoľte prístup k mikrofónu...",
    connecting: "Pripájanie k agentovi...",
    startSession: "Začať reláciu",
    endSession: "Ukončiť reláciu",
    tellCode: "Povedzte tento kód agentovi",
    feedbackInDashboard:
      "Vaša tréningová relácia bola zaznamenaná. Spätná väzba bude dostupná vo vašom dashboarde.",
    listening: "Počúvam...",
    agentSpeaking: "Agent hovorí...",
  },
  hu: {
    outOf100: "100-ból",
    howToImprove: "Hogyan fejlődj",
    strengthNoted: "{count} erősség kiemelve",
    strengthsNoted: "{count} erősség kiemelve",
    areaToImprove: "{count} fejlesztendő terület",
    areasToImprove: "{count} fejlesztendő terület",
    fullFeedback: "A teljes visszajelzés elérhető az irányítópulton",
    analyzing: "Teljesítményed elemzése",
    aiReviewing: "Az AI elemzi a beszélgetésedet...",
    sessionCompleted: "Munkamenet befejezve",
    validating: "Munkamenet ellenőrzése...",
    requestNewLink: "Kérjen új linket az adminisztrátortól.",
    pressStart: "Nyomja meg a Start gombot a munkamenet elindításához",
    allowMic: "Engedélyezze a mikrofon hozzáférést...",
    connecting: "Csatlakozás az ügynökhöz...",
    startSession: "Munkamenet indítása",
    endSession: "Munkamenet befejezése",
    tellCode: "Mondja el ezt a kódot az ügynöknek",
    feedbackInDashboard:
      "A tréning munkamenet rögzítve. A visszajelzés elérhető lesz az irányítópulton.",
    listening: "Hallgatás...",
    agentSpeaking: "Az ügynök beszél...",
  },
};

export function t(locale: CallLocale, key: string, params?: Record<string, string | number>): string {
  let text = translations[locale]?.[key] ?? translations.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
