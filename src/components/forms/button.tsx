const Button = ({
  className,
  ...rest
}: Partial<React.ButtonHTMLAttributes<HTMLButtonElement>>) => {
  return <button className={`py-2 px-3 ${className || ''}`} {...rest}></button>;
};

export default Button;
