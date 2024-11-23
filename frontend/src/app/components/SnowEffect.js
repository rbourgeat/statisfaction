import { useEffect, useState } from "react";

const SnowEffect = () => {
  const [snowflakeStyles, setSnowflakeStyles] = useState([]);

  const generateSnowflakeStyles = () => {
    const styles = Array.from({ length: 75 }).map(() => {
      const randomX = Math.random() * 100;
      const randomDelay = Math.random() * 20;
      const randomDuration = Math.random() * 20 + 10;
      const randomScale = Math.random() * 0.5 + 0.5;
      const randomOpacity = Math.random() * 0.5 + 0.3;

      return {
        left: `${randomX}vw`,
        animationDelay: `${randomDelay}s`,
        animationDuration: `${randomDuration}s`,
        transform: `scale(${randomScale})`,
        opacity: randomOpacity,
        "--x-end": `${randomX + (Math.random() * 20 - 10)}vw`,
      };
    });
    setSnowflakeStyles(styles);
  };

  useEffect(() => {
    generateSnowflakeStyles();
  }, []);

  return (
    <div className="snowfall">
      {snowflakeStyles.map((style, index) => (
        <div key={index} className="snowflake" style={style}></div>
      ))}
    </div>
  );
};

export default SnowEffect;