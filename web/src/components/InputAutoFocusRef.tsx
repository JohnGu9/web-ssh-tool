import React from 'react';

export default function useInputAutoFocusRef(open: boolean, elementTag = 'input') {
    const ref = React.useRef<HTMLLabelElement>(null);
    React.useEffect(() => {
        if (open) {
            const { current } = ref;
            if (current) {
                const input = current.querySelector(elementTag);
                if (input instanceof HTMLElement)
                    input?.focus();
            }
        }
    }, [elementTag, open]);
    return ref;
}
