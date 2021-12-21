import { Stats } from "fs";
import path from "path";
import React from "react";
import { Watch } from "../../../common/Type";
import { SharedAxisTransition } from "../../../components/Transitions";
import FileExplorer, { NavigatorBar } from "./Common";
import InformationDialog from "./directory-preview/InformationDialog";
import RenameDialog from "./directory-preview/RenameDialog";
import FileListTile from "./directory-preview/FileListTile";
import DropZone from "./directory-preview/DropZone";
import ToolsBar, { SelectingToolsBar } from "./directory-preview/ToolsBar";

function DirectoryPreView({ state }: { state: Watch.Directory }) {
  const { path: dir, files } = state;
  const { cd, config } = React.useContext(FileExplorer.Context);
  const [onSelect, setOnSelect] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set<string>());
  const [information, setInformation] = React.useState<InformationDialog.State>({ open: false, path: '', stats: {} as Stats });
  const fileList = Object.entries(files).filter(config.showAll
    ? () => true
    : ([key]) => !key.startsWith('.'));
  return (
    <div className='full-size column' >
      <SharedAxisTransition className='row' style={{ height: 56, padding: '0 8px 0 0' }}
        type={SharedAxisTransition.Type.fromTopToBottom} id={onSelect}>
        {onSelect
          ? <SelectingToolsBar setOnSelect={setOnSelect} state={state} selected={selected} />
          : <ToolsBar dir={dir} setOnSelect={setOnSelect} />}
      </SharedAxisTransition>
      <DropZone style={{ flex: 1, width: '100%', minHeight: 0, overflowY: 'auto' }} dirname={dir}>
        {fileList.length === 0
          ? <div className='column' style={{ width: '100%', justifyContent: 'center', alignItems: 'center' }}>
            Nothing here...
          </div>
          : <>
            {FileExplorer.sortArray(fileList, config.sort)
              .map(([key, value]) => {
                return <FileListTile
                  key={key}
                  dirname={dir}
                  selected={selected.has(key)}
                  onSelect={onSelect}
                  onSelected={value => {
                    if (value) {
                      selected.add(key);
                      setSelected(new Set(selected));
                    } else {
                      selected.delete(key);
                      setSelected(new Set(selected));
                    }
                  }}
                  name={key}
                  stats={value}
                  onClick={() => cd(path.join(dir, key))}
                  onDetail={(stats, path) => setInformation({ open: true, stats, path })} />
              })}
            <div className='row' style={{ height: 64 }} />
          </>}
      </DropZone>
      <div style={{ height: 16 }} />
      <NavigatorBar path={dir} />
      <Dialogs information={information} setInformation={setInformation} />
    </div>
  );
}

export default DirectoryPreView;

function Dialogs({ children, information, setInformation }: {
  children?: React.ReactNode,
  information: InformationDialog.State,
  setInformation: (state: InformationDialog.State) => unknown,
}) {
  const closeInformation = () => setInformation({ ...information, open: false });
  const [rename, setRename] = React.useState<RenameDialog.State>({ open: false, path: '' });
  const closeRename = () => setRename({ ...rename, open: false });
  return (
    <>
      {children}
      <InformationDialog
        key={information.path}
        state={information}
        close={closeInformation}
        rename={path => setRename({ open: true, path })} />
      <RenameDialog
        key={`rename: ${rename.path}`}
        state={rename} close={closeRename} />
    </>
  );
}
