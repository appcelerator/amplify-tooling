# Test data

Folder contains `yaml` files to use and corresponding copy-paste of the real api responses (./apiResponses) for testing purposes.

- To create instances use two provided files: [testInstances1](./testInstances1.yaml), [testInstances1](./testInstances1.yaml),
  and run following cli commands

  ```bash
  axway engage create -f resources/testData/testInstances1.yaml
  axway engage create -f resources/testData/testInstances2.yaml
  ```

- To create just a couple resources (not the full set) use [testInstances1short](./testInstances1short.yaml). This set will be used in some tests just to make nock mocks a bit smaller. If using this set just use first entities from real api responses (ie: "testenv1", "apisvc1", etc.)

  ```bash
  axway engage create -f resources/testData/testInstances1short.yaml
  ```
