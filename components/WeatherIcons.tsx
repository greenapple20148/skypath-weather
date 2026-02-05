
import React from 'react';

export const WeatherIconLarge: React.FC<{ code: number; className?: string }> = ({ code, className }) => {
  // Mapping code to FontAwesome icons
  let iconClass = "fa-sun";
  if (code === 0) iconClass = "fa-sun text-yellow-400";
  else if (code >= 1 && code <= 3) iconClass = "fa-cloud-sun text-gray-200";
  else if (code >= 45 && code <= 48) iconClass = "fa-smog text-slate-300";
  else if (code >= 51 && code <= 67) iconClass = "fa-cloud-showers-heavy text-blue-400";
  else if (code >= 71 && code <= 77) iconClass = "fa-snowflake text-white";
  else if (code >= 80 && code <= 82) iconClass = "fa-cloud-rain text-blue-500";
  else if (code >= 95) iconClass = "fa-bolt-lightning text-yellow-300";

  return <i className={`fa-solid ${iconClass} ${className}`}></i>;
};
