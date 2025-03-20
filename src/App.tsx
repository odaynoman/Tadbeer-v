import React, { useEffect, useState, useRef } from 'react';
import { Send, Loader2, Camera, X, Flame, MapPin, Users } from 'lucide-react';
import Webcam from 'react-webcam';
import DonationMap from './components/DonationMap';
import { analyzeImage, generateRecipe, generateChatTitle } from './services/api';
import { supabase } from './services/supabase';
import AuthModal from './components/AuthModal';
import Sidebar from './components/Sidebar';

type Message = {
  type: 'user' | 'assistant';
  content: string;
};

type MealType = 'فطور' | 'غداء' | 'عشاء' | 'سناك' | 'أخرى';

type Recipe = {
  id: number;
  name: string;
  cookTime: string;

  servings: number;
  mealType: MealType;
  image: string;
  ingredients: {
    name: string;
    amount: number;
    unit: string;
    scalable: boolean;
  }[];
  steps: string[];
};

function App() {
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showDonationMap, setShowDonationMap] = useState(false);
  const [servingCount, setServingCount] = useState(2);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('فطور');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });
  const [streak, setStreak] = useState(() => {
    const saved = localStorage.getItem('streak');
    return saved ? JSON.parse(saved) : { count: 0, lastUpdate: null };
  });
  const [userSettings, setUserSettings] = useState({
    fontSize: 'متوسط',
    language: 'العربية',
    notifications: true,
  });
  const webcamRef = useRef<Webcam>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadChatHistory();
    }
  }, [user]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // تحديث العداد اليومي
    if (user) {
      const today = new Date().toDateString();
      const lastUpdate = streak.lastUpdate ? new Date(streak.lastUpdate).toDateString() : null;
      
      if (lastUpdate !== today) {
        const newStreak = {
          count: lastUpdate ? streak.count + 1 : 1,
          lastUpdate: new Date().toISOString()
        };
        setStreak(newStreak);
        localStorage.setItem('streak', JSON.stringify(newStreak));
      }
    }
  }, [user]);

  useEffect(() => {
    // تحميل الإعدادات عند تسجيل الدخول
    if (user) {
      const savedSettings = localStorage.getItem(`user_settings_${user.id}`);
      if (savedSettings) {
        setUserSettings(JSON.parse(savedSettings));
      }
    }
  }, [user]);

  const generateChatId = () => {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleNewChat = () => {
    const newChatId = generateChatId();
    setMessages([]);
    setHasStarted(false);
    setInputValue('');
    setCurrentChatId(newChatId);
  };

  const handleChatSelect = async (chatId: string) => {
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data.map(item => ({
        type: item.type as 'user' | 'assistant',
        content: item.content
      })));
      setHasStarted(true);
      setCurrentChatId(chatId);
    }
  };

  const saveChatMessage = async (content: string, type: 'user' | 'assistant') => {
    if (!user) return; // Only save messages if logged in

    try {
      let title = undefined;
      if (type === 'user' && messages.length === 0) {
        title = await generateChatTitle(content);
        console.log('Generated title:', title);
      }

      const messageData = {
        user_id: user.id,
        chat_id: currentChatId,
        content,
        type,
        ...(title && { title })
      };

      const { error } = await supabase
        .from('chat_history')
        .insert([messageData]);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  };

  const loadChatHistory = async () => {
    // Load default or public chat history if not logged in
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('type', user ? 'user' : 'public')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMessages(data.map(item => ({
        type: item.type as 'user' | 'assistant',
        content: item.content
      })));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    if (!hasStarted) {
      setHasStarted(true);
    }

    const newMessage: Message = {
      type: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, newMessage]);
    if (user) {
      await saveChatMessage(inputValue, 'user');
    }
    setInputValue('');
    setIsTyping(true);

    try {
      const userId = user?.id || 'anonymous';
      const response = await generateRecipe(userId, inputValue, selectedMealType, servingCount);
      const assistantMessage: Message = {
        type: 'assistant',
        content: response
      };
      setMessages(prev => [...prev, assistantMessage]);
      if (user) {
        await saveChatMessage(response, 'assistant');
      }
    } catch (error) {
      const errorMessage: Message = {
        type: 'assistant',
        content: 'عذراً، حدث خطأ في معالجة طلبك. الرجاء المحاولة مرة أخرى.'
      };
      setMessages(prev => [...prev, errorMessage]);
      if (user) {
        await saveChatMessage(errorMessage.content, errorMessage.type);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMessages([]);
    setHasStarted(false);
  };

  const handleSettingsChange = (newSettings: {
    fontSize: string;
    language: string;
    notifications: boolean;
  }) => {
    setUserSettings(newSettings);
    if (user) {
      localStorage.setItem(`user_settings_${user.id}`, JSON.stringify(newSettings));
    }
  };

  const handleImageUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      setSelectedImage(base64data);
      setIsAnalyzing(true);
      
      try {
        const userId = user?.id || 'anonymous';
        const response = await analyzeImage(userId, base64data);
        setInputValue(prev => prev + (prev ? '\n' : '') + response);
      } catch (error) {
        console.error('Error analyzing image:', error);
        setInputValue(prev => prev + (prev ? '\n' : '') + 'عذراً، حدث خطأ في تحليل الصورة. الرجاء المحاولة مرة أخرى.');
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`flex h-screen ${isDarkMode ? 'dark' : ''}`}>
      <Sidebar
        user={user}
        onNewChat={handleNewChat}
        onChatSelect={handleChatSelect}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onLogout={handleLogout}
        streak={streak}
        onLogin={() => setShowAuthModal(true)}
        onSettingsChange={handleSettingsChange}
        currentChatId={currentChatId}
      />

      <div className="flex-1 flex flex-col h-screen bg-gradient-to-br from-green-800 to-green-600">
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {!hasStarted ? (
            <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full px-4">
              <h1 className="text-4xl font-bold text-white text-center mb-8">
                ماهي المكونات المتبقية لديك؟
              </h1>
              <div className="w-full">
                <form onSubmit={handleSubmit} className="relative">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="اكتب هنا..."
                    className="w-full bg-white/10 text-white rounded-lg px-12 py-4 min-h-[120px] text-right resize-none"
                    dir="rtl"
                  />
                  
                  {/* Image Preview */}
                  {selectedImage && (
                    <div className="absolute left-4 top-[-120px] bg-white/10 p-2 rounded-lg">
                      <div className="relative">
                        <img 
                          src={selectedImage} 
                          alt="Selected" 
                          className="h-[100px] w-[100px] object-cover rounded"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedImage(null)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                        >
                          <X size={14} />
                        </button>
                        {isAnalyzing && (
                          <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                            <Loader2 className="animate-spin text-white" size={24} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={!inputValue.trim()}
                      className={`p-2 rounded-full transition-colors ${
                        inputValue.trim() 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-gray-300'
                      }`}
                    >
                      <Send size={20} className="rotate-[225deg]" />
                    </button>
                  </div>
                  <div className="absolute left-4 bottom-4 flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(file);
                        }
                      }}
                      className="hidden"
                      id="camera-input"
                    />
                    <label
                      htmlFor="camera-input"
                      className={`text-white/50 hover:text-white cursor-pointer ${
                        isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Camera size={20} />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowDonationMap(true)}
                      className="flex items-center gap-2 text-white/50 hover:text-white"
                    >
                      <MapPin size={20} />
                      <span className="text-sm">تبرع بالطعام</span>
                    </button>
                    <div className="h-6 w-[1px] bg-white/20 mx-2" />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setServingCount(prev => Math.max(1, prev - 1))}
                        className="text-white/50 hover:text-white px-1"
                      >
                        -
                      </button>
                      <div className="flex items-center gap-1">
                        <Users size={16} className="text-white/50" />
                        <span className="text-white min-w-[1.5rem] text-center">{servingCount}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setServingCount(prev => prev + 1)}
                        className="text-white/50 hover:text-white px-1"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </form>
                
                {/* Quick Access Buttons */}
                <div className="flex gap-2 mt-4 justify-center" dir="rtl">
                  {(['فطور', 'غداء', 'عشاء', 'سناك', 'أخرى'] as MealType[]).map((meal) => (
                    <button
                      key={meal}
                      onClick={() => setSelectedMealType(meal)}
                      className={`px-4 py-2 rounded-full transition-colors ${
                        selectedMealType === meal 
                          ? 'bg-white/30 text-white' 
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {meal}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl p-4 ${
                        message.type === 'user'
                          ? 'bg-white text-green-800'
                          : 'bg-white/10 text-white'
                      }`}
                      style={{ whiteSpace: 'pre-wrap' }}
                      dangerouslySetInnerHTML={{ __html: message.content }}
                    />
                  </div>
                ))}
                {isTyping && (
                  <div className="flex items-center gap-2 text-white/60">
                    <Loader2 className="animate-spin" size={16} />
                    جاري الكتابة...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white/5 max-w-4xl mx-auto w-full">
                <form onSubmit={handleSubmit} className="relative">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="اكتب هنا..."
                    className="w-full bg-white rounded-lg px-6 py-4 pr-6 pl-32 min-h-[120px] text-right resize-none"
                    dir="rtl"
                  />
                  
                  {/* Image Preview in Chat */}
                  {selectedImage && (
                    <div className="absolute left-4 top-[-120px] bg-white p-2 rounded-lg shadow-lg">
                      <div className="relative">
                        <img 
                          src={selectedImage} 
                          alt="Selected" 
                          className="h-[100px] w-[100px] object-cover rounded"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedImage(null)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                        >
                          <X size={14} />
                        </button>
                        {isAnalyzing && (
                          <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                            <Loader2 className="animate-spin text-white" size={24} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={!inputValue.trim()}
                      className={`p-2 rounded-full transition-colors ${
                        inputValue.trim() 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-gray-300'
                      }`}
                    >
                      <Send size={20} className="rotate-[225deg]" />
                    </button>
                  </div>
                  <div className="absolute left-4 bottom-4 flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(file);
                        }
                      }}
                      className="hidden"
                      id="camera-input-chat"
                    />
                    <label
                      htmlFor="camera-input-chat"
                      className={`text-gray-500 hover:text-gray-700 cursor-pointer ${
                        isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Camera size={20} />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowDonationMap(true)}
                      className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
                    >
                      <MapPin size={20} />
                      <span className="text-sm">تبرع بالطعام</span>
                    </button>
                    <div className="h-6 w-[1px] bg-gray-200 mx-2" />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setServingCount(prev => Math.max(1, prev - 1))}
                        className="text-gray-500 hover:text-gray-700 px-1"
                      >
                        -
                      </button>
                      <div className="flex items-center gap-1">
                        <Users size={16} className="text-gray-500" />
                        <span className="text-gray-700 min-w-[1.5rem] text-center">{servingCount}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setServingCount(prev => prev + 1)}
                        className="text-gray-500 hover:text-gray-700 px-1"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </form>

                {/* Meal Type Selection */}
                <div className="flex gap-2 mt-4 justify-center" dir="rtl">
                  {(['فطور', 'غداء', 'عشاء', 'سناك', 'أخرى'] as MealType[]).map((meal) => (
                    <button
                      key={meal}
                      onClick={() => setSelectedMealType(meal)}
                      className={`px-4 py-2 rounded-full text-sm transition-colors ${
                        selectedMealType === meal 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {meal}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {showDonationMap && <DonationMap onClose={() => setShowDonationMap(false)} />}
      </div>
    </div>
  );
}

export default App;