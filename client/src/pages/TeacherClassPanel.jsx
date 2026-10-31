import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Select, Table, Typography, message } from 'antd';
import { api } from '../api';

export default function TeacherClassPanel({ courses }) {
  const [courseId, setCourseId] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [grades, setGrades] = useState({});
  const [error, setError] = useState('');
  const [directForm] = Form.useForm();
  const [courseForm] = Form.useForm();

  useEffect(() => {
    if (!courseId) {
      setSheet(null);
      return;
    }
    api(`/gradebook/course/${courseId}`)
      .then((data) => {
        setSheet(data);
        const next = {};
        for (const student of data.students) {
          for (const grade of student.grades) {
            if (grade.submission_id) next[grade.submission_id] = grade.grade || '';
          }
        }
        setGrades(next);
      })
      .catch((err) => setError(err.message));
  }, [courseId]);

  const students = (sheet?.students || []).filter((student) => student.user_id);

  async function sendDirect(values) {
    const student = sheet.students.find((item) => item.contact_id === values.contact_id);
    try {
      await api('/messages/threads', {
        method: 'POST',
        body: JSON.stringify({
          subject: values.subject,
          body: values.body,
          contactId: student.contact_id,
          participantIds: [student.user_id],
        }),
      });
      directForm.resetFields(['subject', 'body']);
      message.success(`Сообщение отправлено: ${student.name}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendCourse(values) {
    try {
      const result = await api('/messages/course', {
        method: 'POST',
        body: JSON.stringify({ courseId, subject: values.subject, body: values.body }),
      });
      courseForm.resetFields();
      message.success(`Отправлено ученикам: ${result.sent}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveGrades() {
    const jobs = [];
    for (const student of sheet?.students || []) {
      for (const grade of student.grades) {
        if (!grade.submission_id) continue;
        const next = grades[grade.submission_id];
        if (next == null || next === (grade.grade || '')) continue;
        jobs.push(
          api(`/homework/submissions/${grade.submission_id}`, {
            method: 'PATCH',
            body: JSON.stringify({ grade: next }),
          })
        );
      }
    }
    if (!jobs.length) {
      message.info('Нет изменений');
      return;
    }
    try {
      await Promise.all(jobs);
      message.success('Оценки сохранены');
      const data = await api(`/gradebook/course/${courseId}`);
      setSheet(data);
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    { title: 'Ученик', dataIndex: 'name' },
    {
      title: 'Тесты',
      dataIndex: 'quizAvg',
      render: (value) => (value == null ? '—' : `${value}%`),
    },
    ...(sheet?.homework || []).map((item) => ({
      title: item.title,
      key: item.id,
      render: (_, student) => {
        const grade = student.grades.find((row) => row.homework_id === item.id);
        if (!grade?.submission_id) return '—';
        return (
          <Input
            value={grades[grade.submission_id] ?? ''}
            onChange={(event) =>
              setGrades((prev) => ({ ...prev, [grade.submission_id]: event.target.value }))
            }
            placeholder="Оценка"
          />
        );
      },
    })),
  ];

  return (
    <>
      <Card className="cabinet-card" title="Класс">
        <Typography.Paragraph type="secondary">
          Одно сообщение ученику или всему курсу, и оценки по всем заданиям курса.
        </Typography.Paragraph>
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Курс"
          style={{ minWidth: 280 }}
          value={courseId}
          options={courses.map((course) => ({ value: course.id, label: course.title }))}
          onChange={setCourseId}
        />
      </Card>
      {error && <Alert type="error" showIcon message={error} />}
      {sheet && (
        <>
          <Card className="cabinet-card" title="Написать одному ученику">
            <Form form={directForm} layout="vertical" onFinish={sendDirect}>
              <Form.Item name="contact_id" label="Ученик" rules={[{ required: true, message: 'Выберите ученика' }]}>
                <Select
                  options={students.map((student) => ({ value: student.contact_id, label: student.name }))}
                />
              </Form.Item>
              <Form.Item name="subject" label="Тема" rules={[{ required: true, message: 'Введите тему' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="body" label="Текст" rules={[{ required: true, message: 'Введите текст' }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
              <Button type="primary" htmlType="submit">
                Отправить ученику
              </Button>
            </Form>
          </Card>
          <Card className="cabinet-card" title="Сообщение всему курсу">
            <Typography.Paragraph type="secondary">
              Один текст уходит каждому ученику курса отдельной перепиской.
            </Typography.Paragraph>
            <Form form={courseForm} layout="vertical" onFinish={sendCourse}>
              <Form.Item name="subject" label="Тема" rules={[{ required: true, message: 'Введите тему' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="body" label="Текст" rules={[{ required: true, message: 'Введите текст' }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
              <Button type="primary" htmlType="submit">
                Отправить курсу
              </Button>
            </Form>
          </Card>
          <Card
            className="cabinet-card"
            title="Оценки курса"
            extra={
              <Button type="primary" onClick={saveGrades}>
                Сохранить оценки
              </Button>
            }
          >
            <Table
              rowKey="contact_id"
              pagination={false}
              dataSource={sheet.students}
              columns={columns}
              locale={{ emptyText: 'В курсе пока нет учеников' }}
            />
          </Card>
        </>
      )}
    </>
  );
}
