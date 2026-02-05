import React from 'react';

export const WeatherIconLarge: React.FC<{ code: number; className?: string }> = ({ code, className }) => {
  // Mapping code to FontAwesome icons and accessible labels
  let iconClass = "fa-sun";
  let label = "Sunny";
  
  if (code === 0) {
    iconClass = "fa-sun text-yellow-400";
    label = "Clear and sunny";
  } else if (code >= 1 && code <= 3) {
    iconClass = "fa-cloud-sun text-gray-200";
    label = "Partly cloudy";
  } else if (code >= 45 && code <= 48) {
    iconClass = "fa-smog text-slate-300";
    label = "Foggy conditions";
  } else if (code >= 51 && code <= 67) {
    iconClass = "fa-cloud-showers-heavy text-blue-400";
    label = "Rainy and overcast";
  } else if (code >= 71 && code <= 77) {
    iconClass = "fa-snowflake text-white";
    label = "Snowy conditions";
  } else if (code >= 80 && code <= 82) {
    iconClass = "fa-cloud-rain text-blue-500";
    label = "Showers";
  } else if (code >= 95) {
    iconClass = "fa-bolt-lightning text-yellow-300";
    label = "Thunderstorms";
  }

  return (
    <i 
      className={`fa-solid ${iconClass} ${className}`} 
      role="img" 
      aria-label={label}
      title={label}
    ></i>
  );
};