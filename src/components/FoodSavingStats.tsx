import React from 'react';
import { Leaf, Scale, Droplet } from 'lucide-react';

interface FoodSavingStatsProps {
  savedFood: number; // بالكيلوغرام
  co2Saved: number; // بالكيلوغرام
  waterSaved: number; // باللتر
}

export default function FoodSavingStats({ savedFood, co2Saved, waterSaved }: FoodSavingStatsProps) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4">
      <h3 className="text-white text-lg font-semibold mb-4 text-center">تأثيرك الإيجابي</h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="flex flex-col items-center">
          <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full mb-2">
            <Scale className="text-green-600 dark:text-green-400" size={24} />
          </div>
          <div className="text-2xl font-bold text-white">{savedFood.toFixed(1)}</div>
          <div className="text-sm text-white/70">كغم من الطعام</div>
        </div>
        
        <div className="flex flex-col items-center">
          <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full mb-2">
            <Leaf className="text-green-600 dark:text-green-400" size={24} />
          </div>
          <div className="text-2xl font-bold text-white">{co2Saved.toFixed(1)}</div>
          <div className="text-sm text-white/70">كغم من CO₂</div>
        </div>
        
        <div className="flex flex-col items-center">
          <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full mb-2">
            <Droplet className="text-green-600 dark:text-green-400" size={24} />
          </div>
          <div className="text-2xl font-bold text-white">{waterSaved.toFixed(0)}</div>
          <div className="text-sm text-white/70">لتر من الماء</div>
        </div>
      </div>
    </div>
  );
} 