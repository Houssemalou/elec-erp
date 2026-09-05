const splashStyles = `
@keyframes splash-logo-in {
  0% { opacity: 0; transform: scale(0.85) translateY(12px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes splash-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
@keyframes splash-spin {
  to { transform: rotate(360deg); }
}
@keyframes splash-glow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  #elec-splash * { animation: none !important; }
}
`

export function SplashScreen() {
  return (
    <>
      <style>{splashStyles}</style>
      <div
        id="elec-splash"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          backgroundColor: '#0B0B0B',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 480,
            height: 480,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(255, 196, 0, 0.14) 0%, rgba(255, 196, 0, 0.05) 40%, transparent 70%)',
            animation: 'splash-glow 2.4s ease-in-out infinite',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 96,
              height: 96,
              borderRadius: 20,
              backgroundColor: '#FFFFFF',
              boxShadow: '0 10px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08)',
              animation:
                'splash-logo-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both, splash-breathe 2.4s ease-in-out 0.6s infinite',
            }}
          >
            <img
              src="/logo-url.jpg"
              alt="ElectroNova HA"
              width={72}
              height={72}
              style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 12, display: 'block' }}
            />
          </div>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: -10,
              borderRadius: 26,
              border: '2px solid rgba(255, 196, 0, 0.25)',
              borderTopColor: '#FFC400',
              animation: 'splash-spin 1.1s linear infinite',
            }}
          />
        </div>
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontFamily: "'Space Grotesk', Inter, system-ui, sans-serif",
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: '-0.02em',
              color: '#FFFFFF',
            }}
          >
            ElectroNova <span style={{ color: '#FFC400' }}>HA</span>
          </p>
          <p
            style={{
              margin: '6px 0 0',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 11,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.4)',
            }}
          >
            Chargement…
          </p>
        </div>
      </div>
    </>
  )
}