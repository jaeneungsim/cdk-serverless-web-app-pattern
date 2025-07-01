import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

// WAF Stack (us-east-1)
export class WafStack extends cdk.Stack {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'WebACL',
      },
      rules: [
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
      ],
    });
  }
}

// Backend Stack - Lambda & API Gateway (Sydney)
export class BackendStack extends cdk.Stack {
  public readonly apiGateway: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda functions
    const lambdaFunction1 = new lambda.Function(this, 'ApiHandler1', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/sample-lambda-1'),
    });

    const lambdaFunction2 = new lambda.Function(this, 'ApiHandler2', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/sample-lambda-2'),
    });

    // API Gateway
    this.apiGateway = new apigateway.RestApi(this, 'Api', {
      restApiName: 'Serverless API',
      description: 'API Gateway for serverless web app',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Integrations
    const integration1 = new apigateway.LambdaIntegration(lambdaFunction1);
    const integration2 = new apigateway.LambdaIntegration(lambdaFunction2);
    
    // Add /api resource and sub-resources
    const api = this.apiGateway.root.addResource('api');
    const lambda1Resource = api.addResource('lambda-1');
    const lambda2Resource = api.addResource('lambda-2');
    
    lambda1Resource.addMethod('GET', integration1);
    lambda2Resource.addMethod('GET', integration2);
  }
}

// Frontend Stack - S3 & CloudFront (Sydney)
export class FrontendStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: cdk.StackProps & {
    apiGateway: apigateway.RestApi;
    webAcl: wafv2.CfnWebACL;
  }) {
    super(scope, id, props);

    // S3 Bucket for static website
    this.bucket = new s3.Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // S3 Origin
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(this.bucket);

    // API Gateway Origin
    const apiOrigin = new origins.RestApiOrigin(props.apiGateway);

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
      },
      defaultRootObject: 'index.html',
      webAclId: props.webAcl.attrArn,
    });

    // Deploy web assets to S3 with CloudFront invalidation
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('web')],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
    });
  }
}


// Main Stack - deprecated, kept for compatibility
export class CdkServerlessWebAppPatternStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // This stack is now empty - resources moved to separate stacks
  }
}
