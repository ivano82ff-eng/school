import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Card, FloatButton, Typography } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { api } from '../api';
import LandingBlockRenderer, { useLandingSession } from '../components/LandingBlockRenderer';
import { themeCssVars } from '../utils/landingTheme';

export default function PublicLandingPage() {
  const { slug } = useParams();
  const sessionId = useLandingSession(slug);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!slug) return;
    api(`/landings/public/${slug}?sid=${encodeURIComponent(sessionId || '')}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [slug, sessionId]);

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Alert type="error" showIcon message={error} />
      </div>
    );
  }
  if (!data) return <Card loading style={{ margin: 40 }} />;

  const tokens = data.page.theme?.tokens || {};
  const cssVars = themeCssVars(tokens);

  return (
    <div
      style={{
        ...cssVars,
        minHeight: '100vh',
        background: 'var(--lp-bg)',
        color: 'var(--lp-text)',
        fontFamily: 'var(--lp-font)',
        paddingBottom: 64,
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 12px' }}>
        {data.blocks.map((b) => (
          <LandingBlockRenderer
            key={b.id}
            block={b}
            page={data.page}
            sessionId={sessionId}
            themeTokens={tokens}
            onPoints={(delta, total) => {
              if (total != null) setScore(total);
              else setScore((s) => s + (delta || 0));
            }}
          />
        ))}
        <Typography.Paragraph
          type="secondary"
          style={{ textAlign: 'center', marginTop: 32, fontSize: 12 }}
        >
          {data.page.title} · IT-Scool
        </Typography.Paragraph>
      </div>
      <FloatButton
        icon={<TrophyOutlined />}
        type="primary"
        style={{ right: 24 }}
        badge={{ count: score, overflowCount: 999 }}
        tooltip={`Ваши очки: ${score}`}
      />
    </div>
  );
}
