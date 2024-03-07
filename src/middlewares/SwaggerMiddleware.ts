import express from 'express';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Not complete
export function mountSwaggerMiddleware(app: express.Application): void {
  const options = {
    definition: {
      openapi: '3.1.0',
      info: {
        title: 'Image Processing Server',
        version: '0.1.0',
        description:
          'Online assessment built for Blindspot. This is purely informative, testing out requests does not work',
        license: {
          name: 'MIT',
          url: 'https://spdx.org/licenses/MIT.html',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
        },
      ],
      paths: {
        '/image': {
          post: {
            requestBody: {
              description: 'The image we want to send',
              content: {
                image: {
                  encoding: {
                    contentType: 'multipart/form-data',
                  },
                },
              },
            },
          },
        },
        '/image/': {
          get: {
            description: '',
            parameters: [
              {
                name: 'imageName',
                required: true,
              },
            ],
          },
        },
        '/healthCheck': {
          get: {
            description: 'Provides insights about the state of the service!',
            responses: {
              content: {
                status: {
                  schema: {
                    type: 'string',
                  },
                },
                uptime: {
                  status: {
                    schema: {},
                  },
                },
                permanentImages: {
                  status: {
                    schema: {},
                  },
                },
                cachedImages: {
                  status: {
                    schema: {},
                  },
                },
                cacheHitRatio: {
                  status: {
                    schema: {},
                  },
                },
                cachesMissRatio: {
                  status: {
                    schema: {},
                  },
                },
              },
            },
          },
        },
      },
    },
    apis: ['./routes/*.js'],
  };

  const specs = swaggerJSDoc(options);
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(
      specs,
      {
        explorer: true,
      },
      {
        tryItOutEnabled: false,
      },
    ),
  );
}
