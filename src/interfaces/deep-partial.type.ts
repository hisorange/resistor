export type DeepPartial<T> = {
  [propertyKey in keyof T]?: DeepPartial<T[propertyKey]>;
};
