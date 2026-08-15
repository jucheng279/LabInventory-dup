declare module 'utif' {
  interface IFD {
    width: number;
    height: number;
    data: Uint8Array;
    [key: string]: unknown;
  }

  function decode(buffer: ArrayBuffer): IFD[];
  function decodeImage(buffer: ArrayBuffer, ifd: IFD): void;
  function toRGBA8(ifd: IFD): ArrayBuffer;

  export { decode, decodeImage, toRGBA8, IFD };
  export default { decode, decodeImage, toRGBA8 };
}
