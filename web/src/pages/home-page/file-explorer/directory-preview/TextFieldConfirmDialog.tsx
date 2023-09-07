import React, { ComponentProps } from "react";
import { Button, TextField, Dialog } from "rmcw";
import { useUuidV4 } from "../Common";
import useInputAutoFocusRef from "../../../../components/InputAutoFocusRef";

function TextFieldConfirmDialog({ initialText, title, textField, submitButton, open, onSubmit, close }: TextFieldConfirmDialog.State) {
  const [value, setValue] = React.useState(initialText);
  const id = useUuidV4();
  const ref = useInputAutoFocusRef(open);
  return (
    <Dialog open={open}
      onScrimClick={close}
      onEscapeKey={close}
      title={title}
      actions={<>
        <Button {...submitButton} type='submit' form={id} />
        <Button type='button' label='close' onClick={close} />
      </>}>
      <form id={id}
        onSubmit={async event => {
          event.preventDefault();
          if (await onSubmit(value)) close();
        }}>
        <TextField {...textField}
          required
          id="confirm"
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{ width: 480 }} />
      </form>
    </Dialog>
  );
}

namespace TextFieldConfirmDialog {
  export type State = {
    open: boolean,
    close: () => unknown,
    onSubmit: (text: string) => PromiseLike<boolean>,

    initialText: string,
    title: React.ReactNode,
    submitButton: ComponentProps<typeof Button>,
    textField: Omit<ComponentProps<typeof TextField>, 'value' | 'onChange'>,
  };
}

export default TextFieldConfirmDialog;
