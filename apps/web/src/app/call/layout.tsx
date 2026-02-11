export default function CallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #060E5E 0%, #0112AA 40%, #0B3FBF 70%, #2563EB 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative orbs */}
      <div
        className="animate-float-orb"
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)",
          top: -200,
          right: -150,
          pointerEvents: "none",
        }}
      />
      <div
        className="animate-float-orb-slow"
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)",
          bottom: -100,
          left: -100,
          pointerEvents: "none",
        }}
      />
      <div
        className="animate-float-orb"
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(96,165,250,0.08) 0%, transparent 70%)",
          top: "40%",
          left: "10%",
          pointerEvents: "none",
          animationDelay: "3s",
        }}
      />
      {children}
    </div>
  );
}
