import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { api } from '../api';

const GRADES = Array.from({ length: 11 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} класс`,
}));

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [grade, setGrade] = useState();
  const [category, setCategory] = useState();
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/courses/categories')
      .then((d) => setCategories(d.categories.map((c) => ({ value: c, label: c }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (grade) params.set('grade', grade);
    if (category) params.set('category', category);
    if (q.trim()) params.set('q', q.trim());
    api(`/courses?${params}`)
      .then((d) => setCourses(d.courses))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [grade, category, q]);

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 4 }}>
          Каталог курсов
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Подбери программу под свой класс и интерес.
        </Typography.Paragraph>
      </div>

      <Card>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8} md={6}>
            <Select
              allowClear
              placeholder="Класс"
              style={{ width: '100%' }}
              options={GRADES}
              value={grade}
              onChange={setGrade}
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select
              allowClear
              placeholder="Категория"
              style={{ width: '100%' }}
              options={categories}
              value={category}
              onChange={setCategory}
            />
          </Col>
          <Col xs={24} sm={8} md={12}>
            <Input.Search
              allowClear
              placeholder="Python, Scratch, веб..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </Col>
        </Row>
      </Card>

      {error && <Alert type="error" message={error} showIcon />}

      {!loading && courses.length === 0 ? (
        <Empty description="Ничего не найдено" />
      ) : (
        <Row gutter={[16, 16]}>
          {courses.map((course) => (
            <Col xs={24} sm={12} lg={8} key={course.id}>
              <Link to={`/courses/${course.id}`} style={{ display: 'block', height: '100%' }}>
                <Card
                  hoverable
                  className="course-accent"
                  style={{ '--accent': course.cover_color, height: '100%' }}
                  title={
                    <Space>
                      <span>{course.icon}</span>
                      <span>{course.title}</span>
                    </Space>
                  }
                  extra={<Tag>{course.category}</Tag>}
                >
                  <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }}>
                    {course.description}
                  </Typography.Paragraph>
                  <Space>
                    <Tag>
                      {course.grade_min}–{course.grade_max} кл.
                    </Tag>
                    <Tag>{course.lessonsCount} уроков</Tag>
                  </Space>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      )}
    </Space>
  );
}
