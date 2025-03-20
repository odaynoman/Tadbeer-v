import React, { useState } from 'react';
import { User, LogOut } from 'lucide-react';
import { supabase } from '../services/supabase';

interface UserMenuProps {
  user: any;
  onShowAuth: () => void;
}

export default function UserMenu({ user, onShowAuth }: UserMenuProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => user ? setShowMenu(!showMenu) : onShowAuth()}
        className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20"
      >
        <User className="text-white" size={24} />
      </button>

      {showMenu && user && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-10">
          <div className="px-4 py-2 text-sm text-gray-700 border-b">
            {user.email}
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
          >
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        </div>
      )}
    </div>
  );
}