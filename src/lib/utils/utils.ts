import chalk from "chalk";
import {
  ApiServerVersions,
  GenericResource,
  GenericResourceWithoutName,
  LanguageTypes,
  Metadata,
  ResourceDefinition,
} from "../types.js";

export function ValueFromKey(
  stringEnum: { [key: string]: string },
  key: string,
): string | undefined {
  for (const k of Object.values(stringEnum)) {
    if (k === stringEnum[key]) return k;
  }
  return undefined;
}

export const createLanguageSubresourceNames = (langCode: string) => {
  const langCodeArr = langCode.split(",");
  let langSubresourceNamesArr = ["languages"];
  let languageTypesArr: (string | undefined)[] = [];
  Object.keys(LanguageTypes).forEach((key) =>
    languageTypesArr.push(ValueFromKey(LanguageTypes, key)),
  );
  langCodeArr.forEach((langCode) => {
    if (langCode.trim() != "") {
      if (!languageTypesArr.includes(langCode)) {
        console.log(
          chalk.yellow(
            `\n\'${langCode}\' language code is not supported, hence create/update cannot be performed on \'languages-${langCode}\. Allowed language codes: ${LanguageTypes.French} | ${LanguageTypes.German} | ${LanguageTypes.US} | ${LanguageTypes.Portugese}.'`,
          ),
        );
      } else {
        langSubresourceNamesArr.push(`languages-${langCode.trim()}`);
      }
    }
  });

  return langSubresourceNamesArr;
};

export const getLatestServedAPIVersion = (
  resourceDef: ResourceDefinition,
): string => {
  let apiVersions = resourceDef.spec.apiVersions;
  if (apiVersions && apiVersions.length > 0) {
    for (const version of apiVersions) {
      if (version.served && !version.deprecated) {
        return version.name;
      }
    }
    return ApiServerVersions.v1alpha1;
  }
  // if the apiVersions are not set on the resource definition, fallback to v1alpha1 version
  return ApiServerVersions.v1alpha1;
};

/**
 * Api-server returns the "resourceVersion" in metadata object as a counter for resource updates.
 * If a user will send this key in the payload it will throw an error so using this helper to sanitizing metadata on
 * the updates.
 * @param doc resource data
 * @returns {GenericResource} resource data without metadata.resourceVersion key
 */
export function sanitizeMetadata(doc: GenericResource): GenericResource;
export function sanitizeMetadata(
  doc: GenericResourceWithoutName,
): GenericResourceWithoutName;
export function sanitizeMetadata(
  doc: GenericResource | GenericResourceWithoutName,
): GenericResource | GenericResourceWithoutName {
  if (doc?.metadata?.resourceVersion) {
    delete doc.metadata.resourceVersion;
  }
  return doc;
}

/**
 * Generate a GenericResource instance from resource definition, resource name, and scope name. Used
 * in some rendering logic for the "delete" command.
 * Note that generated metadata includes only scope info.
 * @param {ResourceDefinition} resourceDef resource definition
 * @param {string} resourceName resource name
 * @param {string} scopeName optional scope name
 * @returns {GenericResource} generic resource representation
 */
export const buildGenericResource = ({
  resourceDef,
  resourceName,
  scopeName,
}: {
  resourceDef: ResourceDefinition;
  resourceName?: string;
  scopeName?: string;
}): GenericResource | GenericResourceWithoutName => {
  if (resourceName) {
    return {
      apiVersion: resourceDef?.apiVersion,
      group: resourceDef?.group,
      title: resourceName,
      name: resourceName,
      kind: resourceDef?.spec.kind,
      attributes: {},
      tags: [],
      metadata:
        resourceDef?.spec?.scope && scopeName
          ? ({
              scope: {
                kind: resourceDef?.spec?.scope?.kind,
                name: scopeName,
              },
              // note: forced conversion here only because using generated resources for rendering simple text
            } as unknown as Metadata)
          : undefined,
      spec: {},
    };
  } else {
    return {
      apiVersion: resourceDef?.apiVersion,
      group: resourceDef?.group,
      kind: resourceDef?.spec.kind,
      attributes: {},
      tags: [],
      metadata:
        resourceDef?.spec?.scope && scopeName
          ? ({
              scope: {
                kind: resourceDef?.spec?.scope?.kind,
                name: scopeName,
              },
              // note: forced conversion here only because using generated resources for rendering simple text
            } as unknown as Metadata)
          : undefined,
      spec: {},
    };
  }
};
