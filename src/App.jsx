import React, { useState, useEffect } from 'react';
import AdminApp from './AdminApp';
import { ConfigProvider, Layout, Card, Input, Button, Typography, message } from 'antd';
import { SafetyCertificateOutlined, UserOutlined, LockOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { supabase } from './supabaseClient';

const { Title, Text } = Typography;

export default function App() {
  const [role, setRole] = useState(null); // 'admin' or 'student'
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [loginType, setLoginType] = useState('Admin'); // Always Admin now

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
              <Text type="secondary">Admin panelga kirish</Text>
            </div>

            <div style={{ marginBottom: 24 }}></div>

            <LoginForm onLogin={handleLogin} loading={loading} type={loginType} />
          </Card>
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={{ token: { fontFamily: "'Outfit', sans-serif" } }}>
      <AdminApp onLogout={handleLogout} />
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
        placeholder="Admin login" 
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
