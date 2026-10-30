import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AutoComplete, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { api } from '../api';

const TYPE_LABEL = {
  contact: 'Контакт',
  lead: 'Заявка',
  group: 'Группа',
  course: 'Курс',
  trial: 'Пробный',
};

export default function GlobalSearch() {
  const [options, setOptions] = useState([]);
  const navigate = useNavigate();

  async function onSearch(q) {
    if (!q || q.trim().length < 2) {
      setOptions([]);
      return;
    }
    try {
      const data = await api(`/search?q=${encodeURIComponent(q.trim())}`);
      setOptions(
        (data.results || []).map((r) => ({
          value: `${r.type}:${r.id}`,
          label: (
            <div>
              <strong>{r.title}</strong>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {TYPE_LABEL[r.type] || r.type} · {r.subtitle}
              </div>
            </div>
          ),
          link: r.link,
        }))
      );
    } catch {
      setOptions([]);
    }
  }

  return (
    <AutoComplete
      options={options}
      onSearch={onSearch}
      onSelect={(_, opt) => {
        if (opt.link) navigate(opt.link);
      }}
      style={{ width: 220, maxWidth: '28vw' }}
    >
      <Input allowClear prefix={<SearchOutlined />} placeholder="Поиск..." />
    </AutoComplete>
  );
}
