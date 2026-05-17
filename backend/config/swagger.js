// ============================================
// Swagger/OpenAPI Configuration
// ============================================
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GreenLink+ API',
      version: '1.0.0',
      description: 'GreenLink+ Environmental Monitoring System — REST API Documentation',
      contact: { name: 'GreenLink+ Team' }
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Development' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'GreenLink+ API Docs'
  }));
}

module.exports = { setupSwagger };
