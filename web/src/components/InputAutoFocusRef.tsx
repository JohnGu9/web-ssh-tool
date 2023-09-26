import React from 'react';

export default function useInputAutoFocusRef(open: boolean, elementSelectors = 'input') {
    const ref = React.useRef<HTMLLabelElement>(null);
    React.useEffect(() => {
        if (open) {
            const { current } = ref;
            if (current) {
                const input = current.querySelector(elementSelectors);
                if (input instanceof HTMLElement)
                    input?.focus();
            }
        }
    }, [elementSelectors, open]);
    return ref;
}
