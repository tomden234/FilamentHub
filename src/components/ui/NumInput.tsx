import React, { forwardRef, useEffect, useRef, useState } from 'react';

// Zahlenfeld, das sich frei tippen lässt: Man kann es leeren und neu eintippen, ohne dass es sofort auf einen Standardwert springt.
// Gleiche Eigenschaften wie <input type="number">. Beim Verlassen zeigt das Feld wieder den gespeicherten Wert.
export const NumInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function NumInput(
  { value, onChange, onBlur, onFocus, ...rest },
  ref
) {
  const shown = value === undefined || value === null ? '' : String(value);
  const [text, setText] = useState(shown);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(shown);
  }, [shown]);
  return (
    <input
      {...rest}
      ref={ref}
      type="number"
      inputMode={rest.inputMode ?? 'decimal'}
      value={text}
      onFocus={e => {
        focused.current = true;
        onFocus?.(e);
      }}
      onChange={e => {
        setText(e.target.value);
        onChange?.(e);
      }}
      onBlur={e => {
        focused.current = false;
        setText(shown);
        onBlur?.(e);
      }}
    />
  );
});
