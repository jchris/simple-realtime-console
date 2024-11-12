import { useState, useEffect, useRef } from 'react';

export function Toggle({
  defaultValue = false,
  values,
  labels,
  onChange = () => {},
}: {
  defaultValue?: string | boolean;
  values?: string[];
  labels?: string[];
  onChange?: (isEnabled: boolean, value: string) => void;
}) {
  if (typeof defaultValue === 'string') {
    defaultValue = !!Math.max(0, (values || []).indexOf(defaultValue));
  }

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<boolean>(defaultValue);

  const toggleValue = () => {
    const v = !value;
    const index = +v;
    setValue(v);
    onChange(v, (values || [])[index]);
  };

  useEffect(() => {
    const leftEl = leftRef.current;
    const rightEl = rightRef.current;
    const bgEl = bgRef.current;
    if (leftEl && rightEl && bgEl) {
      if (value) {
        bgEl.style.left = rightEl.offsetLeft + 'px';
        bgEl.style.width = rightEl.offsetWidth + 'px';
      } else {
        bgEl.style.left = '';
        bgEl.style.width = leftEl.offsetWidth + 'px';
      }
    }
  }, [value]);

  return (
    <div
      data-component="Toggle"
      onClick={toggleValue}
      data-enabled={value.toString()}
      className="relative flex items-center gap-2 cursor-pointer overflow-hidden bg-[#ececf1] text-[#101010] h-10 rounded-[1000px] hover:bg-[#d8d8d8]"
    >
      {labels && (
        <div ref={leftRef} className="label left relative text-[#666] transition-colors duration-100 px-4 z-[2] select-none data-[enabled=false]:text-white">
          {labels[0]}
        </div>
      )}
      {labels && (
        <div ref={rightRef} className="label right relative text-[#666] transition-colors duration-100 px-4 z-[2] select-none -ml-2 data-[enabled=true]:text-white">
          {labels[1]}
        </div>
      )}
      <div ref={bgRef} className="toggle-background bg-[#101010] absolute top-0 left-0 bottom-0 z-[1] rounded-[1000px] transition-all duration-100"></div>
    </div>
  );
}
