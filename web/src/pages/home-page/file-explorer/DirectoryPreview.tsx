import { Stats } from "fs";
import path from "path";
import React from "react";
import { FileType, Watch } from "../../../common/Type";
import { SharedAxisTransition } from "../../../components/Transitions";
import FileExplorer, { NavigatorBar } from "./Common";
import InformationDialog from "./directory-preview/InformationDialog";
import RenameDialog from "./directory-preview/RenameDialog";
import FileListTile from "./directory-preview/FileListTile";
import DropZone from "./directory-preview/DropZone";
import ToolsBar, { SelectingToolsBar } from "./directory-preview/ToolsBar";
import { FixedSizeList } from "../../../components/AdaptedWindow";

function DirectoryPreView({ state }: { state: Watch.Directory }) {
  const { path: dir, files } = state;
  const { config } = React.useContext(FileExplorer.Context);
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
      <DropZone style={{ flex: 1, width: '100%', minHeight: 0 }} dirname={dir}>
        {fileList.length === 0
          ? <div className='column' style={{ width: '100%', justifyContent: 'center', alignItems: 'center' }}>
            Nothing here...
          </div>
          : <List dir={dir} onSelect={onSelect}
            selected={selected} setSelected={setSelected}
            setInformation={setInformation}
            list={FileExplorer.sortArray(fileList, config.sort)} />}
      </DropZone>
      <div style={{ height: 16 }} />
      <NavigatorBar path={dir} />
      <Dialogs information={information} setInformation={setInformation} />
    </div>
  );
}

export default DirectoryPreView;

function List({ dir, onSelect, selected, setSelected, setInformation, list }: {
  dir: string,
  onSelect: boolean,
  selected: Set<string>,
  setSelected: (value: Set<string>) => unknown,
  setInformation: (state: InformationDialog.State) => unknown,
  list: [string, Stats & {
    type?: FileType | undefined;
  }][]
}) {
  const { cd } = React.useContext(FileExplorer.Context);
  return (
    <FixedSizeList key={list as any} className='full-size'
      itemCount={list.length + 2} itemSize={48}>
      {({ index, style }) => {
        if (index >= list.length) return <></>;
        const [key, value] = list[index];
        return <FileListTile
          key={key}
          style={style}
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
      }}
    </FixedSizeList>
  );
}

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
