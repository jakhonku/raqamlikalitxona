import React, { useState, useEffect } from 'react';
import AdminApp from './AdminApp';
import StudentApp from './StudentApp';
import { ConfigProvider, theme, Layout, Card, Input, Button, Typography, message, Segmented } from 'antd';
import { SafetyCertificateOutlined, UserOutlined, LockOutlined, ArrowRightOutlined, SettingOutlined, TeamOutlined } from '@ant-design/icons';
import { supabase } from './supabaseClient';

const { Title, Text } = Typography;

export default function App() {
  const [role, setRole] = useState(null); // 'admin' or 'student'
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [loginType, setLoginType] = useState('Talaba'); // Toggle between Student and Admin login

  // Persistence check
  useEffect(() => {
    const saved = localStorage.getItem('app_auth');
    if (saved) {
      const auth = JSON.parse(saved);
      setUser(auth.user);
      setRole(auth.role);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = async (id, pass) => {
    setLoading(true);
    if (loginType === 'Talaba') {
      const { data, error } = await supabase.from('users').select('*').eq('id', id.trim()).eq('password', pass.trim()).single();
      if (data) {
        setRole('student');
        setUser(data);
        setIsLoggedIn(true);
        localStorage.setItem('app_auth', JSON.stringify({ role: 'student', user: data }));
        message.success("Xush kelibsiz!");
      } else {
        message.error("ID yoki parol noto'g'ri!");
      }
    } else {
      // Admin login logic
      const { data } = await supabase.from('admin_config').select('*').eq('username', id.trim()).eq('password', pass.trim()).single();
      if (data) {
        setRole('admin');
        setUser({ name: 'Admin' });
        setIsLoggedIn(true);
        localStorage.setItem('app_auth', JSON.stringify({ role: 'admin', user: { name: 'Admin' } }));
        message.success("Admin panelga xush kelibsiz!");
      } else {
        message.error("Admin login yoki paroli noto'g'ri!");
      }
    }
    setLoading(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setRole(null);
    setUser(null);
    localStorage.removeItem('app_auth');
  };

  if (!isLoggedIn) {
    return (
      <ConfigProvider theme={{ token: { fontFamily: "'Outfit', sans-serif" } }}>
        <div className="login-page" style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#f8fafc',
          padding: '20px'
        }}>
          <Card className="glass-card login-card" bordered={false} style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
            <div style={{ marginBottom: 30 }}>
              <SafetyCertificateOutlined style={{ fontSize: 40, color: '#1e40af', marginBottom: 10 }} />
              <Title level={2} style={{ margin: 0 }}>Raqamli Kalitxona</Title>
              <Text type="secondary">Tizimga kirish uchun turini tanlang</Text>
            </div>

            <Segmented
              block
              size="large"
              value={loginType}
              onChange={setLoginType}
              options={[
                { label: 'Talaba', value: 'Talaba', icon: <TeamOutlined /> },
                { label: 'Admin', value: 'Admin', icon: <SettingOutlined /> }
              ]}
              style={{ marginBottom: 24, background: '#f1f5f9' }}
            />

            <LoginForm onLogin={handleLogin} loading={loading} type={loginType} />
          </Card>
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={{ token: { fontFamily: "'Outfit', sans-serif" } }}>
      {role === 'admin' ? (
        <AdminApp onLogout={handleLogout} />
      ) : (
        <StudentApp user={user} onLogout={handleLogout} />
      )}
    </ConfigProvider>
  );
}

function LoginForm({ onLogin, loading, type }) {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');

  return (
    <div className="animate-fade-in">
      <Input 
        size="large" 
        prefix={<UserOutlined />} 
        placeholder={type === 'Talaba' ? "RK-1001" : "Admin login"} 
        value={id} 
        onChange={e => setId(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      <Input.Password 
        size="large" 
        prefix={<LockOutlined />} 
        placeholder="Parol" 
        value={pass} 
        onChange={e => setPass(e.target.value)}
        style={{ marginBottom: 24 }}
        onPressEnter={() => onLogin(id, pass)}
      />
      <Button type="primary" size="large" block loading={loading} onClick={() => onLogin(id, pass)} style={{ height: 48, fontWeight: 600 }}>
        Kirish <ArrowRightOutlined />
      </Button>
    </div>
  );
}
