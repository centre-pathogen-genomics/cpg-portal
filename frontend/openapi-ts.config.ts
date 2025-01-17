import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-axios',
  input: './openapi.json',
  output: './src/client',
  experimentalParser: true,
//   exportSchemas: true,
  plugins: [
    {
      name: '@hey-api/sdk',
      // NOTE: this doesn't allow tree-shaking
      asClass: true,
    //   operationId: true,
    //   methodNameBuilder: (operation) => {
    //     // @ts-ignore
    //     let name: string = operation.id;
    //     // @ts-ignore
    //     let service: string = operation.tags[0];

    //     if (service && name.toLowerCase().startsWith(service.toLowerCase())) {
    //       name = name.slice(service.length);
    //     }

    //     return name.charAt(0).toLowerCase() + name.slice(1);
    //   },
    },
    '@tanstack/react-query', 
  ],
});
