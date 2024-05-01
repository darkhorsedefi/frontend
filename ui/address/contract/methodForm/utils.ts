import _set from 'lodash/set';

import type { SmartContractMethodArgType, SmartContractMethodInput } from 'types/api/contract';

export type ContractMethodFormFields = Record<string, string | boolean | undefined>;

export const INT_REGEXP = /^(u)?int(\d+)?$/i;

export const BYTES_REGEXP = /^bytes(\d+)?$/i;

export const ARRAY_REGEXP = /^(.*)\[(\d*)\]$/;

export interface MatchArray {
  itemType: SmartContractMethodArgType;
  size: number;
  isNested: boolean;
}

export const matchArray = (argType: SmartContractMethodArgType): MatchArray | null => {
  const match = argType.match(ARRAY_REGEXP);
  if (!match) {
    return null;
  }

  const [ , itemType, size ] = match;
  const isNested = Boolean(matchArray(itemType as SmartContractMethodArgType));

  return {
    itemType: itemType as SmartContractMethodArgType,
    size: size ? Number(size) : Infinity,
    isNested,
  };
};

export interface MatchInt {
  isUnsigned: boolean;
  power: string;
  min: bigint;
  max: bigint;
}

export const matchInt = (argType: SmartContractMethodArgType): MatchInt | null => {
  const match = argType.match(INT_REGEXP);
  if (!match) {
    return null;
  }

  const [ , isUnsigned, power = '256' ] = match;
  const [ min, max ] = getIntBoundaries(Number(power), Boolean(isUnsigned));

  return { isUnsigned: Boolean(isUnsigned), power, min, max };
};

export const transformDataForArrayItem = (data: SmartContractMethodInput, index: number): SmartContractMethodInput => {
  const arrayMatchType = matchArray(data.type);
  const arrayMatchInternalType = data.internalType ? matchArray(data.internalType as SmartContractMethodArgType) : null;
  const childrenInternalType = arrayMatchInternalType?.itemType.replaceAll('struct ', '');

  const postfix = childrenInternalType ? ' ' + childrenInternalType : '';

  return {
    ...data,
    type: arrayMatchType?.itemType || data.type,
    internalType: childrenInternalType,
    name: `#${ index + 1 }${ postfix }`,
  };
};

export const getIntBoundaries = (power: number, isUnsigned: boolean) => {
  const maxUnsigned = BigInt(2 ** power);
  const max = isUnsigned ? maxUnsigned - BigInt(1) : maxUnsigned / BigInt(2) - BigInt(1);
  const min = isUnsigned ? BigInt(0) : -maxUnsigned / BigInt(2);
  return [ min, max ];
};

export function transformFormDataToMethodArgs(formData: ContractMethodFormFields) {
  const result: Array<unknown> = [];

  for (const field in formData) {
    const value = formData[field];
    if (value !== undefined) {
      _set(result, field.replaceAll(':', '.'), value);
    }
  }

  return filterOurEmptyItems(result);
}

function filterOurEmptyItems(array: Array<unknown>): Array<unknown> {
  // The undefined value may occur in two cases:
  //    1. When an optional form field is left blank by the user.
  //        The only optional field is the native coin value, which is safely handled in the form submit handler.
  //    2. When the user adds and removes items from a field array.
  //        In this scenario, empty items need to be filtered out to maintain the correct sequence of arguments.
  return array
    .map((item) => Array.isArray(item) ? filterOurEmptyItems(item) : item)
    .filter((item) => item !== undefined);
}

export function getFieldLabel(input: SmartContractMethodInput, isRequired?: boolean) {
  const name = input.name || input.internalType || '<unnamed argument>';
  return `${ name } (${ input.type })${ isRequired ? '*' : '' }`;
}
