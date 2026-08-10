import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export default forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="flex flex-col gap-0.5 bg-panvas-bg-elevated rounded-xl shadow-xl border border-panvas-border-subtle p-2 w-48 overflow-y-auto max-h-64">
      <div className="text-xs font-semibold text-panvas-text-tertiary px-2 py-1.5 uppercase tracking-wider">Turn Into</div>
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <button
            key={index}
            onClick={() => selectItem(index)}
            className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left ${
              index === selectedIndex ? 'bg-panvas-bg-hover text-panvas-text-primary font-medium' : 'text-panvas-text-primary hover:bg-panvas-bg-hover'
            }`}
          >
            <div className="text-panvas-text-secondary">{item.icon}</div>
            {item.title}
          </button>
        ))
      ) : (
        <div className="text-panvas-text-secondary px-2 py-1.5 text-sm">No result</div>
      )}
    </div>
  );
});
