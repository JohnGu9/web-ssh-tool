import { FileType } from "../../../../common/Type";

export function fileIcon({ type }: { type?: FileType | null, }, extension?: string) {
    switch (type) {
        case FileType.directory:
            return 'folder';
        case FileType.file: {
            if (extension !== undefined) {
                // @TODO: complete the type predict
                switch (extension.toLowerCase()) {
                    case 'apng':
                    case 'avif':
                    case 'jpg':
                    case 'jpeg':
                    case 'pjpeg':
                    case 'jfif':
                    case 'pjp':
                    case 'png':
                    case 'svg':
                    case 'webp':
                    case 'tif':
                    case 'tiff':
                    case 'ico':
                    case 'cur':
                    case 'bmp':
                    case 'gif':
                    case 'raw':
                        return 'image'; // https://en.wikipedia.org/wiki/Image_file_format
                    case 'mp3':
                    case 'ogg':
                    case 'flac':
                    case 'acc':
                    case 'alac':
                    case 'wav':
                    case 'aiff':
                        return 'headphones'; // https://en.wikipedia.org/wiki/Audio_file_format
                    case 'mp4':
                    case 'flv':
                    case 'avi':
                    case 'mkv':
                    case 'webm':
                        return 'videocam'; // https://en.wikipedia.org/wiki/Video_file_format
                    case 'zip':
                    case '7z':
                    case 'tar':
                    case 'txz':
                    case 'tgz':
                    case 'bz2':
                    case 'tbz2':
                    case 'gz':
                    case 'xz':
                    case 'rar':
                    case 'z':
                        return 'folder_zip';// https://en.wikipedia.org/wiki/Archive_file
                }
            }
            return 'text_snippet';
        }
        case FileType.symbolicLink:
            return 'link';
        case FileType.socket:
            return 'electrical_services';
        default:
            return 'browser_not_supported';
    }
}
