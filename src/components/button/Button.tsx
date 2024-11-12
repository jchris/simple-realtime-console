import React from 'react';
import { Icon } from 'react-feather';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  icon?: Icon;
  iconPosition?: 'start' | 'end';
  iconColor?: 'red' | 'green' | 'grey';
  iconFill?: boolean;
  buttonStyle?: 'regular' | 'action' | 'alert' | 'flush';
}

export function Button({
  label = 'Okay',
  icon = void 0,
  iconPosition = 'start',
  iconColor = void 0,
  iconFill = false,
  buttonStyle = 'regular',
  className = '',
  ...rest
}: ButtonProps) {
  const StartIcon = iconPosition === 'start' ? icon : null;
  const EndIcon = iconPosition === 'end' ? icon : null;
  
  const baseClasses = "flex items-center gap-2 font-['Roboto_Mono'] text-xs font-normal border-none rounded-[1000px] px-6 min-h-[42px] transition-all duration-100 outline-none disabled:text-[#999] enabled:cursor-pointer";
  const styleClasses = {
    regular: "bg-[#ececf1] text-[#101010] hover:enabled:bg-[#d8d8d8]",
    action: "bg-[#101010] text-[#ececf1] hover:enabled:bg-[#404040]",
    alert: "bg-red-600 text-[#ececf1] hover:enabled:bg-red-600",
    flush: "bg-transparent"
  }[buttonStyle];
  
  const iconColorClasses = iconColor ? {
    red: "[&_.icon]:text-[#cc0000]",
    green: "[&_.icon]:text-[#009900]",
    grey: "[&_.icon]:text-[#909090]"
  }[iconColor] : '';
  
  const iconFillClass = iconFill ? "[&_.icon_svg]:fill-current" : "";
  
  const activeClass = "active:enabled:translate-y-[1px]";

  return (
    <button 
      data-component="Button" 
      className={`${baseClasses} ${styleClasses} ${iconColorClasses} ${iconFillClass} ${activeClass} ${className}`} 
      {...rest}
    >
      {StartIcon && (
        <span className="icon flex -ml-2">
          <StartIcon className="w-4 h-4" />
        </span>
      )}
      <span>{label}</span>
      {EndIcon && (
        <span className="icon flex -mr-2">
          <EndIcon className="w-4 h-4" />
        </span>
      )}
    </button>
  );
}
