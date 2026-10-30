import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Dropdown, Empty, Flex, List, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { api } from '../api';

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  function load() {
    api('/notifications')
      .then((d) => {
        setItems(d.notifications);
        setUnread(d.unread);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function markAll() {
    await api('/notifications/read-all', { method: 'POST' });
    load();
  }

  async function openItem(n) {
    if (!n.read_at) {
      await api(`/notifications/${n.id}/read`, { method: 'POST' });
      load();
    }
    setOpen(false);
  }

  const panel = (
    <div style={{ width: 320, maxWidth: '90vw' }} data-tour="nav-notifications">
      <Flex justify="space-between" align="center" style={{ padding: '8px 12px' }}>
        <Typography.Text strong>Уведомления</Typography.Text>
        {unread > 0 && (
          <Button type="link" size="small" onClick={markAll}>
            Прочитать все
          </Button>
        )}
      </Flex>
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пока тихо" />
      ) : (
        <List
          style={{ maxHeight: 360, overflow: 'auto' }}
          dataSource={items}
          renderItem={(n) => (
            <List.Item
              style={{
                padding: '10px 12px',
                background: n.read_at ? undefined : 'var(--color-selection)',
              }}
            >
              {n.link ? (
                <Link to={n.link} onClick={() => openItem(n)} style={{ width: '100%' }}>
                  <Typography.Text strong>{n.title}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary">{n.body}</Typography.Text>
                </Link>
              ) : (
                <Button type="text" block style={{ textAlign: 'left', height: 'auto' }} onClick={() => openItem(n)}>
                  <Typography.Text strong>{n.title}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary">{n.body}</Typography.Text>
                </Button>
              )}
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      popupRender={() => panel}
      placement="bottomRight"
    >
      <Badge count={unread} size="small" overflowCount={9}>
        <Button type="text" icon={<BellOutlined />} aria-label="Уведомления" />
      </Badge>
    </Dropdown>
  );
}
