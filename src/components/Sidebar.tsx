import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  PlusCircle,
  Settings,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  User,
  LogOut,
  Flame,
} from 'lucide-react';
import { supabase } from '../services/supabase';

interface ChatEntry {
  chat_id: string;
  created_at: string;
  first_message: string;
  title: string;
}

interface SidebarProps {
  user: any;
  onNewChat: () => void;
  onChatSelect: (chatId: string) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  streak: { count: number };
  onLogin: () => void;
  currentChatId: string | null;
  onSettingsChange?: (settings: {
    fontSize: string;
    language: string;
    notifications: boolean;
  }) => void;
}

export default function Sidebar({
  user,
  onNewChat,
  onChatSelect,
  isDarkMode,
  onToggleTheme,
  onLogout,
  streak,
  onLogin,
  currentChatId,
  onSettingsChange,
}: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    fontSize: 'متوسط',
    language: 'العربية',
    notifications: true,
  });

  useEffect(() => {
    if (user) {
      loadChatHistory();
      // Subscribe to chat_history changes
      const channel = supabase
        .channel('chat_history_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_history',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            loadChatHistory();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setChatHistory([]);
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isExpanded) {
      setShowSettings(false);
    }
  }, [isExpanded]);

  useEffect(() => {
    const savedSettings = localStorage.getItem('user_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      applySettings(parsed);
    }
  }, []);

  const loadChatHistory = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'user')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const chatGroups = data.reduce((groups: { [key: string]: any[] }, message) => {
        const chatId = message.chat_id;
        if (!groups[chatId]) {
          groups[chatId] = [];
        }
        groups[chatId].push(message);
        return groups;
      }, {});

      const processedHistory = Object.entries(chatGroups).map(([chatId, messages]) => {
        const firstMessage = messages[messages.length - 1];
        // البحث عن أول رسالة تحتوي على عنوان
        const messageWithTitle = messages.find(msg => msg.title);
        return {
          chat_id: chatId,
          created_at: firstMessage.created_at,
          first_message: firstMessage.content.substring(0, 30) + '...',
          title: messageWithTitle?.title || 'محادثة جديدة'
        };
      });

      setChatHistory(processedHistory.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applySettings = (newSettings: typeof settings) => {
    document.documentElement.style.fontSize = 
      newSettings.fontSize === 'كبير' ? '18px' : 
      newSettings.fontSize === 'صغير' ? '14px' : '16px';

    document.documentElement.dir = newSettings.language === 'العربية' ? 'rtl' : 'ltr';
    document.documentElement.lang = newSettings.language === 'العربية' ? 'ar' : 'en';

    localStorage.setItem('user_settings', JSON.stringify(newSettings));
  };

  const handleSettingsChange = (newSettings: typeof settings) => {
    setSettings(newSettings);
    applySettings(newSettings);
    onSettingsChange?.(newSettings);
  };

  return (
    <div
      className={`${
        isExpanded ? 'w-64' : 'w-16'
      } h-screen absolute left-0 top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out flex flex-col z-50 hover:w-64 group`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* User Profile Section */}
      <div 
        className={`p-4 border-b border-gray-200 dark:border-gray-700 ${!user ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}`}
        onClick={() => !user && onLogin()}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => !user && onLogin()}
            className={`min-w-[30px] h-10 bg-green-100 dark:bg-green-900 rounded-md flex items-center justify-center transition-all duration-300 ease-in-out ${isExpanded ? 'rounded-lg' : 'rounded-md'}`}
          >
            <User className="text-green-600 dark:text-green-400" size={20} />
          </button>
          <div className={`flex-1 min-w-0 ${!isExpanded ? 'group-hover:block hidden' : 'block'}`}>
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {user ? user.email : 'تسجيل الدخول'}
            </p>
          </div>
        </div>
        {user && (
          <div className={`flex items-center gap-2 ${!isExpanded ? 'group-hover:flex hidden' : 'flex'}`}>
            <Flame className="text-orange-400" size={20} />
            <span className="text-gray-600 dark:text-gray-300 font-bold">{streak.count}</span>
          </div>
        )}
      </div>

      {/* New Chat Button */}
      <button
        onClick={onNewChat}
        className={`m-4 flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg p-2 hover:bg-green-700 transition-colors ${
          isExpanded ? 'px-4' : 'px-2'
        }`}
      >
        <PlusCircle size={20} />
        <span className={!isExpanded ? 'group-hover:block hidden' : 'block'}>محادثة جديدة</span>
      </button>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
          </div>
        ) : chatHistory.length > 0 ? (
          chatHistory.map((chat) => (
            <button
              key={chat.chat_id}
              onClick={() => onChatSelect(chat.chat_id)}
              className={`w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                !isExpanded && 'justify-center'
              }`}
            >
              {isExpanded || true ? (
                <>
                  <p className={`text-sm font-medium text-gray-900 dark:text-white truncate ${!isExpanded ? 'group-hover:block hidden' : 'block'}`}>
                    {chat.title}
                  </p>
                  <p className={`text-xs text-gray-500 dark:text-gray-400 ${!isExpanded ? 'group-hover:block hidden' : 'block'}`}>
                    {format(new Date(chat.created_at), 'PPp', { locale: ar })}
                  </p>
                </>
              ) : (
                <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              )}
            </button>
          ))
        ) : user ? (
          <div className="text-center p-4 text-gray-500 dark:text-gray-400">
            لا توجد محادثات سابقة
          </div>
        ) : null}
      </div>

      {/* Settings & Theme Toggle */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-2">
        <button
          onClick={onToggleTheme}
          className={`w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
            !isExpanded && 'justify-center'
          }`}
        >
          {isDarkMode ? (
            <Sun size={20} className="text-gray-600 dark:text-gray-300" />
          ) : (
            <Moon size={20} className="text-gray-600 dark:text-gray-300" />
          )}
          <span className={`text-gray-600 dark:text-gray-300 ${!isExpanded ? 'group-hover:block hidden' : 'block'}`}>
            {isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
          </span>
        </button>
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
            !isExpanded && 'justify-center'
          } ${showSettings ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
        >
          <Settings size={20} className="text-gray-600 dark:text-gray-300" />
          <span className={`text-gray-600 dark:text-gray-300 ${!isExpanded ? 'group-hover:block hidden' : 'block'}`}>
            الإعدادات
          </span>
        </button>

        {showSettings && isExpanded && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-4 shadow-lg border border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">حجم الخط</label>
              <select
                value={settings.fontSize}
                onChange={(e) => handleSettingsChange({ ...settings, fontSize: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-700 rounded p-2 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600"
                dir={settings.language === 'العربية' ? 'rtl' : 'ltr'}
              >
                <option>صغير</option>
                <option>متوسط</option>
                <option>كبير</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {settings.language === 'العربية' ? 'اللغة' : 'Language'}
              </label>
              <select
                value={settings.language}
                onChange={(e) => handleSettingsChange({ ...settings, language: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-700 rounded p-2 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600"
                dir={settings.language === 'العربية' ? 'rtl' : 'ltr'}
              >
                <option value="العربية">العربية</option>
                <option value="English">English</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {settings.language === 'العربية' ? 'الإشعارات' : 'Notifications'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={(e) => {
                    handleSettingsChange({ ...settings, notifications: e.target.checked });
                    if (e.target.checked) {
                      Notification.requestPermission();
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
              </label>
            </div>
          </div>
        )}

        {user && (
          <button
            onClick={onLogout}
            className={`w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              !isExpanded && 'justify-center'
            }`}
          >
            <LogOut size={20} className="text-red-600" />
            <span className={`text-red-600 ${!isExpanded ? 'group-hover:block hidden' : 'block'}`}>
              {settings.language === 'العربية' ? 'تسجيل الخروج' : 'Logout'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}