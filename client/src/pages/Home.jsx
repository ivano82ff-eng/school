import { Link } from 'react-router-dom';
import { Button, Card, Col, Row, Space, Typography } from 'antd';

const { Title, Paragraph } = Typography;

export default function Home() {
  return (
    <Space direction="vertical" size={28} style={{ width: '100%' }}>
      <section className="hero-panel">
        <div className="hero-inner">
          <p className="hero-brand">IT-Scool</p>
          <Title level={2} style={{ color: '#fff', marginTop: 0, maxWidth: '18ch' }}>
            IT-курсы для детей и подростков до 11 класса
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.92)', fontSize: 16, maxWidth: 460 }}>
            Scratch, Python, веб, алгоритмы и кибербезопасность — учимся с понятными уроками и
            мини-тестами.
          </Paragraph>
          <Space wrap>
            <Link to="/courses">
              <Button type="primary" size="large">
                Смотреть курсы
              </Button>
            </Link>
            <Link to="/apply">
              <Button size="large">Оставить заявку</Button>
            </Link>
            <Link to="/product">
              <Button size="large" type="dashed">
                Презентация платформы
              </Button>
            </Link>
          </Space>
        </div>
      </section>

      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          Как устроено обучение
        </Title>
        <Paragraph type="secondary">Выбрать курс → пройти уроки → закрепить тестом.</Paragraph>
        <Row gutter={[16, 16]}>
          {[
            ['01', 'Выбери класс и тему', 'Курсы размечены по классам от 1 до 11.'],
            ['02', 'Учись по урокам', 'Короткие тексты и примеры кода.'],
            ['03', 'Проверь себя', 'Квизы и прогресс в личном кабинете.'],
          ].map(([n, t, d]) => (
            <Col xs={24} md={8} key={n}>
              <Card>
                <Typography.Text type="success" strong style={{ fontSize: 20 }}>
                  {n}
                </Typography.Text>
                <Title level={4} style={{ marginTop: 8 }}>
                  {t}
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {d}
                </Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      <div>
        <Title level={3}>Для кого платформа</Title>
        <Row gutter={[16, 16]}>
          {[
            ['Ученики', 'Записывайся на курсы и следи за прогрессом.'],
            ['Преподаватели', 'Веди группы, оплаты, ДЗ и расписание в офисе.'],
            ['Родители', 'Кабинет с оплатами, посещаемостью и домашками.'],
          ].map(([t, d]) => (
            <Col xs={24} md={8} key={t}>
              <Card>
                <Title level={4}>{t}</Title>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {d}
                </Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </Space>
  );
}
