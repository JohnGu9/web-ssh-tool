import React from "react";
import { Lstat, Watch } from "../../../common/Type";
import { SharedAxis, SharedAxisTransform } from 'material-design-transform';
import { FixedSizeList } from "../../../components/AdaptedWindow";
import EventListenerBuilder from "../../../components/EventListenerBuilder";

import FileExplorer, { NavigatorBar } from "./Common";
import InformationDialog from "./directory-preview/InformationDialog";
import RenameDialog from "./directory-preview/RenameDialog";
import FileListTile from "./directory-preview/FileListTile";
import DropZone from "./directory-preview/DropZone";
import ToolsBar, { SelectingToolsBar } from "./directory-preview/ToolsBar";

function DirectoryPreView({ state }: { state: Watch.Directory }) {
  const { path, realPath, entries } = state;
  const { cd, config, uploadItems } = React.useContext(FileExplorer.Context);
  const [onSelecting, setOnSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set<Lstat>());
  const [information, setInformation] = React.useState<InformationDialog.State>({ open: false, stats: {} as Lstat, dirname: path ?? "" });
  const fileList = FileExplorer.sortArray(Object.entries(entries).filter(config.showAll
    ? () => true
    : ([key]) => !key.startsWith('.')), config.sort);
  return (
    <div className='full-size column' >
      <SharedAxis className='row' style={{ height: 56, padding: '0 8px 0 0' }}
        transform={SharedAxisTransform.fromTopToBottom} keyId={onSelecting ? 0 : 1}>
        {onSelecting
          ? <SelectingToolsBar setOnSelect={setOnSelecting} state={state} selected={selected} setSelected={setSelected} />
          : <ToolsBar path={path} realPath={realPath} setOnSelect={setOnSelecting} />}
      </SharedAxis>
      <DropZone style={{ flex: 1, width: '100%', minHeight: 0 }} dirname={path}>
        {fileList.length === 0
          ? <div className='column' style={{ width: '100%', justifyContent: 'center', alignItems: 'center' }}>
            Nothing here...
          </div>
          : <List dirname={path} realPath={realPath}
            fileList={fileList} cd={cd}
            selected={selected} setSelected={setSelected} onSelecting={onSelecting}
            setInformation={setInformation} uploadItems={uploadItems} />}
      </DropZone>
      <div style={{ height: 16 }} />
      {path === undefined || path === null ?
        <></> : // @TODO: new navigator bar
        <NavigatorBar path={path} />}
      <Dialogs key={information.stats.path} information={information} setInformation={setInformation} />
    </div>
  );
}

export default DirectoryPreView;

class List extends React.Component<{
  dirname: string | null | undefined,
  realPath: string | null | undefined,
  fileList: [string, Lstat][],
  selected: Set<Lstat>,
  setSelected: (value: Set<Lstat>) => unknown,
  onSelecting: boolean,
  cd: (value: string | null) => unknown,
  setInformation: (value: InformationDialog.State) => unknown
  uploadItems: FileExplorer.UploadController[],
}> {

  protected readonly eventTarget = new EventTarget();
  override componentDidUpdate(oldProp: any) {
    if (this.props.uploadItems !== oldProp.uploadItems) {
      this.eventTarget.dispatchEvent(new Event('change'));
    } else if (Object.keys(this.props).some(value => (this.props as any)[value] !== oldProp[value])) {
      this.eventTarget.dispatchEvent(new Event('change'));
    }
  }

  builder = ({ index, style }: { index: number, style?: React.CSSProperties }) => {
    return <EventListenerBuilder eventName='change' eventTarget={this.eventTarget}
      builder={() => {
        const { dirname, realPath, fileList, selected, setSelected, onSelecting, cd, setInformation } = this.props;
        if (index >= fileList.length) return <React.Fragment key={index}></React.Fragment>;
        const [key, value] = fileList[index];
        const { path, basename } = value;
        return <FileListTile
          key={key}
          style={style}
          uploading={this.props.uploadItems.find(v => {
            return false; // @TODO: detect uploading status
            // return (v.detail.dest === dirname || v.detail.dest === realPath) && v.detail.basename === basename;
          }) !== undefined}
          onSelecting={onSelecting}
          selected={selected.has(value)}
          onSelected={v => {
            if (v) {
              selected.add(value);
              setSelected(new Set(selected));
            } else {
              selected.delete(value);
              setSelected(new Set(selected));
            }
          }}
          name={key}
          stats={value}
          onClick={path === undefined ? undefined : () => cd(path)}
          onDetail={(stats) => {
            if (dirname !== undefined && dirname !== null) {
              setInformation({ open: true, stats, dirname });
            }
          }} />;
      }} />;
  }

  override render() {
    const { fileList } = this.props;
    return (
      <FixedSizeList className='full-size' itemCount={fileList.length + 2} itemSize={48}>
        {this.builder}
      </FixedSizeList>
    );
  }
}

function Dialogs({ information, setInformation }: {
  information: InformationDialog.State,
  setInformation: (state: InformationDialog.State) => unknown,
}) {
  const closeInformation = () => setInformation({ ...information, open: false });
  const [rename, setRename] = React.useState<RenameDialog.State>({ open: false, dirname: information.dirname, file: information.stats });
  const closeRename = () => setRename(v => { return { ...v, open: false } });
  return (
    <>
      <InformationDialog
        state={information}
        close={closeInformation}
        rename={() => setRename(v => { return { ...v, open: true } })} />
      <RenameDialog
        state={rename}
        close={closeRename} />
    </>
  );
}
