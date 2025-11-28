import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className = '', children, ...props }) => {
  const baseStyles = "px-6 py-3 rounded-lg font-bold transition-all transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  let variantStyles = "";
  switch (variant) {
    case 'primary':
      variantStyles = "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 focus:ring-blue-500";
      break;
    case 'secondary':
      variantStyles = "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/30 focus:ring-purple-500";
      break;
    case 'outline':
      variantStyles = "border-2 border-gray-500 text-gray-300 hover:border-gray-300 hover:text-white focus:ring-gray-500";
      break;
  }

  return (
    <button className={`${baseStyles} ${variantStyles} ${className}`} {...props}>
      {children}
    </button>
  );
};
