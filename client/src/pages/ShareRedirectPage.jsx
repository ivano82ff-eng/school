import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Card, Spin } from 'antd';
import { api } from '../api';

export default function ShareRedirectPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/shares/${token}`)
      .then((d) => {
        if (d.payload?.redirect) navigate(d.payload.redirect, { replace: true });
        else setError('Некуда перейти по этой ссылке');
      })
      .catch((e) => setError(e.message));
  }, [token, navigate]);

  if (error) return <Alert type="error" message={error} showIcon />;
  return (
    <Card>
      <Spin /> Открываем ссылку…
    </Card>
  );
}
