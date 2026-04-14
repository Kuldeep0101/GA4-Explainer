import { useRef, useEffect } from 'react';

interface HelpVideoProps {
  src: string;
  title?: string;
}

export function HelpVideo({ src, title }: HelpVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoRef.current?.play().catch(e => console.log("Autoplay blocked:", e));
          } else {
            videoRef.current?.pause();
          }
        });
      },
      { threshold: 0.5 } // Play when at least 50% visible
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div style={{ marginTop: '12px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--card-bg)' }}>
      {title && (
        <div style={{ padding: '8px 12px', fontSize: '13px', fontWeight: '500', borderBottom: '1px solid var(--border)', background: 'var(--secondary)' }}>
          {title}
        </div>
      )}
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        style={{ width: '100%', display: 'block', maxHeight: '300px', objectFit: 'cover' }}
      />
    </div>
  );
}
