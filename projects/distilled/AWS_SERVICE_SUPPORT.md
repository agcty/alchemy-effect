# AWS Service Support

This document provides an overview of AWS services supported by itty-aws.

## Summary

- **Total Services**: 414

### By Protocol

- **restJson1**: 245 services (e.g., Lambda, API Gateway, EKS, EFS)
- **awsJson1_1**: 105 services (e.g., CloudTrail, Secrets Manager, WAFv2, CloudWatch Events, CloudWatch Logs)
- **awsJson1_0**: 43 services (e.g., DynamoDB, SQS, Step Functions (SFN))
- **awsQuery**: 16 services (e.g., IAM, CloudWatch, RDS, DocDB)
- **restXml**: 4 services (e.g., S3, CloudFront, Route 53, S3 Control)
- **ec2Query**: 1 services (EC2)

## Full Service Details

| Service Name | SDK ID | Protocol | Version | ARN Namespace | Endpoint Prefix |
|--------------|--------|----------|---------|---------------|-----------------|
| accessanalyzer | AccessAnalyzer | restJson1 | 2019-11-01 | access-analyzer |  |
| account | Account | restJson1 | 2021-02-01 | account |  |
| acm | ACM | awsJson1_1 | 2015-12-08 | acm | acm |
| acm-pca | ACM PCA | awsJson1_1 | 2017-08-22 | acm-pca | acm-pca |
| aiops | AIOps | restJson1 | 2018-05-10 | aiops |  |
| amp | amp | restJson1 | 2020-08-01 | aps |  |
| amplify | Amplify | restJson1 | 2017-07-25 | amplify | amplify |
| amplifybackend | AmplifyBackend | restJson1 | 2020-08-11 | amplifybackend | amplifybackend |
| amplifyuibuilder | AmplifyUIBuilder | restJson1 | 2021-08-11 | amplifyuibuilder |  |
| api-gateway | API Gateway | restJson1 | 2015-07-09 | apigateway | apigateway |
| apigatewaymanagementapi | ApiGatewayManagementApi | restJson1 | 2018-11-29 | apigateway | execute-api |
| apigatewayv2 | ApiGatewayV2 | restJson1 | 2018-11-29 | apigateway | apigateway |
| app-mesh | App Mesh | restJson1 | 2019-01-25 | appmesh |  |
| appconfig | AppConfig | restJson1 | 2019-10-09 | appconfig | appconfig |
| appconfigdata | AppConfigData | restJson1 | 2021-11-11 | appconfigdata | appconfigdata |
| appfabric | AppFabric | restJson1 | 2023-05-19 | appfabric |  |
| appflow | Appflow | restJson1 | 2020-08-23 | appflow | appflow |
| appintegrations | AppIntegrations | restJson1 | 2020-07-29 | app-integrations | app-integrations |
| application-auto-scaling | Application Auto Scaling | awsJson1_1 | 2016-02-06 | application-autoscaling | application-autoscaling |
| application-discovery-service | Application Discovery Service | awsJson1_1 | 2015-11-01 | discovery | discovery |
| application-insights | Application Insights | awsJson1_1 | 2018-11-25 | applicationinsights | applicationinsights |
| application-signals | Application Signals | restJson1 | 2024-04-15 | application-signals | application-signals |
| applicationcostprofiler | ApplicationCostProfiler | restJson1 | 2020-09-10 | application-cost-profiler | application-cost-profiler |
| apprunner | AppRunner | awsJson1_0 | 2020-05-15 | apprunner | apprunner |
| appstream | AppStream | awsJson1_1 | 2016-12-01 | appstream | appstream2 |
| appsync | AppSync | restJson1 | 2017-07-25 | appsync | appsync |
| apptest | AppTest | restJson1 | 2022-12-06 | apptest | apptest |
| arc-region-switch | ARC Region switch | awsJson1_0 | 2022-07-26 | arc-region-switch | arc-region-switch |
| arc-zonal-shift | ARC Zonal Shift | restJson1 | 2022-10-30 |  | arc-zonal-shift |
| artifact | Artifact | restJson1 | 2018-05-10 | artifact |  |
| athena | Athena | awsJson1_1 | 2017-05-18 | athena | athena |
| auditmanager | AuditManager | restJson1 | 2017-07-25 | auditmanager | auditmanager |
| auto-scaling | Auto Scaling | awsQuery | 2011-01-01 | autoscaling | autoscaling |
| auto-scaling-plans | Auto Scaling Plans | awsJson1_1 | 2018-01-06 | autoscaling-plans | autoscaling-plans |
| b2bi | b2bi | awsJson1_0 | 2022-06-23 |  | b2bi |
| backup | Backup | restJson1 | 2018-11-15 | backup | backup |
| backup-gateway | Backup Gateway | awsJson1_0 | 2021-01-01 | backup-gateway | backup-gateway |
| backupsearch | BackupSearch | restJson1 | 2018-05-10 | backup-search | backup-search |
| batch | Batch | restJson1 | 2016-08-10 | batch | batch |
| bcm-data-exports | BCM Data Exports | awsJson1_1 | 2023-11-26 | bcm-data-exports | bcm-data-exports |
| bcm-pricing-calculator | BCM Pricing Calculator | awsJson1_0 | 2024-06-19 | bcm-pricing-calculator |  |
| bedrock | Bedrock | restJson1 | 2023-04-20 |  | bedrock |
| bedrock-agent | Bedrock Agent | restJson1 | 2023-06-05 | bedrock | bedrock-agent |
| bedrock-agent-runtime | Bedrock Agent Runtime | restJson1 | 2023-07-26 | bedrock | bedrock-agent-runtime |
| bedrock-agentcore | Bedrock AgentCore | restJson1 | 2024-02-28 | bedrock-agentcore | bedrock-agentcore |
| bedrock-agentcore-control | Bedrock AgentCore Control | restJson1 | 2023-06-05 | bedrock-agentcore | bedrock-agentcore-control |
| bedrock-data-automation | Bedrock Data Automation | restJson1 | 2023-07-26 | bedrock | bedrock-data-automation |
| bedrock-data-automation-runtime | Bedrock Data Automation Runtime | awsJson1_1 | 2024-06-13 | bedrock | bedrock-data-automation-runtime |
| bedrock-runtime | Bedrock Runtime | restJson1 | 2023-09-30 |  | bedrock-runtime |
| billing | Billing | awsJson1_0 | 2023-09-07 | billing | billing |
| billingconductor | billingconductor | restJson1 | 2021-07-30 | billingconductor |  |
| braket | Braket | restJson1 | 2019-09-01 |  |  |
| budgets | Budgets | awsJson1_1 | 2016-10-20 | budgets | budgets |
| chatbot | chatbot | restJson1 | 2017-10-11 | chatbot | chatbot |
| chime | Chime | restJson1 | 2018-05-01 | chime | chime |
| chime-sdk-identity | Chime SDK Identity | restJson1 | 2021-04-20 | chime | identity-chime |
| chime-sdk-media-pipelines | Chime SDK Media Pipelines | restJson1 | 2021-07-15 | chime | media-pipelines-chime |
| chime-sdk-meetings | Chime SDK Meetings | restJson1 | 2021-07-15 | chime | meetings-chime |
| chime-sdk-messaging | Chime SDK Messaging | restJson1 | 2021-05-15 | chime | messaging-chime |
| chime-sdk-voice | Chime SDK Voice | restJson1 | 2022-08-03 | chime | voice-chime |
| cleanrooms | CleanRooms | restJson1 | 2022-02-17 | cleanrooms |  |
| cleanroomsml | CleanRoomsML | restJson1 | 2023-09-06 | cleanrooms-ml |  |
| cloud9 | Cloud9 | awsJson1_1 | 2017-09-23 | cloud9 | cloud9 |
| cloudcontrol | CloudControl | awsJson1_0 | 2021-09-30 |  | cloudcontrolapi |
| clouddirectory | CloudDirectory | restJson1 | 2017-01-11 | clouddirectory | clouddirectory |
| cloudformation | CloudFormation | awsQuery | 2010-05-15 | cloudformation | cloudformation |
| cloudfront | CloudFront | restXml | 2020-05-31 | cloudfront | cloudfront |
| cloudfront-keyvaluestore | CloudFront KeyValueStore | restJson1 | 2022-07-26 | key-value-store | cloudfront-keyvaluestore |
| cloudhsm | CloudHSM | awsJson1_1 | 2014-05-30 | cloudhsm | cloudhsm |
| cloudhsm-v2 | CloudHSM V2 | awsJson1_1 | 2017-04-28 | cloudhsm | cloudhsmv2 |
| cloudsearch | CloudSearch | awsQuery | 2013-01-01 | cloudsearch | cloudsearch |
| cloudsearch-domain | CloudSearch Domain | restJson1 | 2013-01-01 | cloudsearch | cloudsearchdomain |
| cloudtrail | CloudTrail | awsJson1_1 | 2013-11-01 | cloudtrail | cloudtrail |
| cloudtrail-data | CloudTrail Data | restJson1 | 2021-08-11 |  | cloudtrail-data |
| cloudwatch | CloudWatch | awsQuery | 2010-08-01 | monitoring | monitoring |
| cloudwatch-events | CloudWatch Events | awsJson1_1 | 2015-10-07 | events | events |
| cloudwatch-logs | CloudWatch Logs | awsJson1_1 | 2014-03-28 | logs | logs |
| codeartifact | codeartifact | restJson1 | 2018-09-22 | codeartifact | codeartifact |
| codebuild | CodeBuild | awsJson1_1 | 2016-10-06 | codebuild | codebuild |
| codecatalyst | CodeCatalyst | restJson1 | 2022-09-28 |  | codecatalyst |
| codecommit | CodeCommit | awsJson1_1 | 2015-04-13 | codecommit | codecommit |
| codeconnections | CodeConnections | awsJson1_0 | 2023-12-01 | codeconnections | codeconnections |
| codedeploy | CodeDeploy | awsJson1_1 | 2014-10-06 | codedeploy | codedeploy |
| codeguru-reviewer | CodeGuru Reviewer | restJson1 | 2019-09-19 | codeguru-reviewer | codeguru-reviewer |
| codeguru-security | CodeGuru Security | restJson1 | 2018-05-10 | codeguru-security |  |
| codeguruprofiler | CodeGuruProfiler | restJson1 | 2019-07-18 | codeguru-profiler | codeguru-profiler |
| codepipeline | CodePipeline | awsJson1_1 | 2015-07-09 | codepipeline | codepipeline |
| codestar-connections | CodeStar connections | awsJson1_0 | 2019-12-01 | codestar-connections | codestar-connections |
| codestar-notifications | codestar notifications | restJson1 | 2019-10-15 | codestar-notifications | codestar-notifications |
| cognito-identity | Cognito Identity | awsJson1_1 | 2014-06-30 | cognito-identity | cognito-identity |
| cognito-identity-provider | Cognito Identity Provider | awsJson1_1 | 2016-04-18 | cognito-idp | cognito-idp |
| cognito-sync | Cognito Sync | restJson1 | 2014-06-30 | cognito-sync | cognito-sync |
| comprehend | Comprehend | awsJson1_1 | 2017-11-27 | comprehend | comprehend |
| comprehendmedical | ComprehendMedical | awsJson1_1 | 2018-10-30 | comprehendmedical | comprehendmedical |
| compute-optimizer | Compute Optimizer | awsJson1_0 | 2019-11-01 | compute-optimizer | compute-optimizer |
| config-service | Config Service | awsJson1_1 | 2014-11-12 | config | config |
| connect | Connect | restJson1 | 2017-08-08 | connect | connect |
| connect-contact-lens | Connect Contact Lens | restJson1 | 2020-08-21 | connect | contact-lens |
| connectcampaigns | ConnectCampaigns | restJson1 | 2021-01-30 | connect-campaigns |  |
| connectcampaignsv2 | ConnectCampaignsV2 | restJson1 | 2024-04-23 | connect-campaigns |  |
| connectcases | ConnectCases | restJson1 | 2022-10-03 | cases | cases |
| connectparticipant | ConnectParticipant | restJson1 | 2018-09-07 | connect | participant.connect |
| controlcatalog | ControlCatalog | restJson1 | 2018-05-10 | controlcatalog |  |
| controltower | ControlTower | restJson1 | 2018-05-10 | controltower | controltower |
| cost-and-usage-report-service | Cost and Usage Report Service | awsJson1_1 | 2017-01-06 | cur | cur |
| cost-explorer | Cost Explorer | awsJson1_1 | 2017-10-25 | ce | ce |
| cost-optimization-hub | Cost Optimization Hub | awsJson1_0 | 2022-07-26 |  | cost-optimization-hub |
| customer-profiles | Customer Profiles | restJson1 | 2020-08-15 | profile | profile |
| data-pipeline | Data Pipeline | awsJson1_1 | 2012-10-29 | datapipeline | datapipeline |
| database-migration-service | Database Migration Service | awsJson1_1 | 2016-01-01 | dms | dms |
| databrew | DataBrew | restJson1 | 2017-07-25 | databrew | databrew |
| dataexchange | DataExchange | restJson1 | 2017-07-25 | dataexchange | dataexchange |
| datasync | DataSync | awsJson1_1 | 2018-11-09 | datasync | datasync |
| datazone | DataZone | restJson1 | 2018-05-10 | datazone |  |
| dax | DAX | awsJson1_1 | 2017-04-19 | dax | dax |
| deadline | deadline | restJson1 | 2023-10-12 | deadline |  |
| detective | Detective | restJson1 | 2018-10-26 | detective | api.detective |
| device-farm | Device Farm | awsJson1_1 | 2015-06-23 | devicefarm | devicefarm |
| devops-guru | DevOps Guru | restJson1 | 2020-12-01 | devops-guru | devops-guru |
| direct-connect | Direct Connect | awsJson1_1 | 2012-10-25 | directconnect | directconnect |
| directory-service | Directory Service | awsJson1_1 | 2015-04-16 | ds | ds |
| directory-service-data | Directory Service Data | restJson1 | 2023-05-31 | ds | ds-data |
| dlm | DLM | restJson1 | 2018-01-12 | dlm | dlm |
| docdb | DocDB | awsQuery | 2014-10-31 | rds | rds |
| docdb-elastic | DocDB Elastic | restJson1 | 2022-11-28 | docdb-elastic |  |
| drs | drs | restJson1 | 2020-02-26 | drs |  |
| dsql | DSQL | restJson1 | 2018-05-10 | dsql | dsql |
| dynamodb | DynamoDB | awsJson1_0 | 2012-08-10 | dynamodb | dynamodb |
| dynamodb-streams | DynamoDB Streams | awsJson1_0 | 2012-08-10 | dynamodb | streams.dynamodb |
| ebs | EBS | restJson1 | 2019-11-02 | ebs | ebs |
| ec2 | EC2 | ec2Query | 2016-11-15 | ec2 | ec2 |
| ec2-instance-connect | EC2 Instance Connect | awsJson1_1 | 2018-04-02 | ec2-instance-connect | ec2-instance-connect |
| ecr | ECR | awsJson1_1 | 2015-09-21 | ecr | api.ecr |
| ecr-public | ECR PUBLIC | awsJson1_1 | 2020-10-30 | ecr-public | api.ecr-public |
| ecs | ECS | awsJson1_1 | 2014-11-13 | ecs | ecs |
| efs | EFS | restJson1 | 2015-02-01 | elasticfilesystem | elasticfilesystem |
| eks | EKS | restJson1 | 2017-11-01 | eks | eks |
| eks-auth | EKS Auth | restJson1 | 2023-11-26 | eks-auth | eks-auth |
| elastic-beanstalk | Elastic Beanstalk | awsQuery | 2010-12-01 | elasticbeanstalk | elasticbeanstalk |
| elastic-load-balancing | Elastic Load Balancing | awsQuery | 2012-06-01 | elasticloadbalancing | elasticloadbalancing |
| elastic-load-balancing-v2 | Elastic Load Balancing v2 | awsQuery | 2015-12-01 | elasticloadbalancing | elasticloadbalancing |
| elastic-transcoder | Elastic Transcoder | restJson1 | 2012-09-25 | elastictranscoder | elastictranscoder |
| elasticache | ElastiCache | awsQuery | 2015-02-02 | elasticache | elasticache |
| elasticsearch-service | Elasticsearch Service | restJson1 | 2015-01-01 | es | es |
| emr | EMR | awsJson1_1 | 2009-03-31 | elasticmapreduce | elasticmapreduce |
| emr-containers | EMR containers | restJson1 | 2020-10-01 | emr-containers | emr-containers |
| emr-serverless | EMR Serverless | restJson1 | 2021-07-13 | emr-serverless |  |
| entityresolution | EntityResolution | restJson1 | 2018-05-10 | entityresolution |  |
| eventbridge | EventBridge | awsJson1_1 | 2015-10-07 | events | events |
| evidently | Evidently | restJson1 | 2021-02-01 | evidently |  |
| evs | evs | awsJson1_0 | 2023-07-27 | evs |  |
| finspace | finspace | restJson1 | 2021-03-12 | finspace | finspace |
| finspace-data | finspace data | restJson1 | 2020-07-13 | finspace-api | finspace-api |
| firehose | Firehose | awsJson1_1 | 2015-08-04 | firehose | firehose |
| fis | fis | restJson1 | 2020-12-01 | fis | fis |
| fms | FMS | awsJson1_1 | 2018-01-01 | fms | fms |
| forecast | forecast | awsJson1_1 | 2018-06-26 | forecast | forecast |
| forecastquery | forecastquery | awsJson1_1 | 2018-06-26 | forecast | forecastquery |
| frauddetector | FraudDetector | awsJson1_1 | 2019-11-15 | frauddetector | frauddetector |
| freetier | FreeTier | awsJson1_0 | 2023-09-07 |  | freetier |
| fsx | FSx | awsJson1_1 | 2018-03-01 | fsx | fsx |
| gamelift | GameLift | awsJson1_1 | 2015-10-01 | gamelift | gamelift |
| gameliftstreams | GameLiftStreams | restJson1 | 2018-05-10 | gameliftstreams |  |
| geo-maps | Geo Maps | restJson1 | 2020-11-19 | geo-maps |  |
| geo-places | Geo Places | restJson1 | 2020-11-19 | geo-places |  |
| geo-routes | Geo Routes | restJson1 | 2020-11-19 | geo-routes |  |
| glacier | Glacier | restJson1 | 2012-06-01 | glacier | glacier |
| global-accelerator | Global Accelerator | awsJson1_1 | 2018-08-08 | globalaccelerator | globalaccelerator |
| glue | Glue | awsJson1_1 | 2017-03-31 | glue | glue |
| grafana | grafana | restJson1 | 2020-08-18 | grafana |  |
| greengrass | Greengrass | restJson1 | 2017-06-07 | greengrass | greengrass |
| greengrassv2 | GreengrassV2 | restJson1 | 2020-11-30 | greengrass | greengrass |
| groundstation | GroundStation | restJson1 | 2019-05-23 | groundstation |  |
| guardduty | GuardDuty | restJson1 | 2017-11-28 | guardduty | guardduty |
| health | Health | awsJson1_1 | 2016-08-04 | health | health |
| healthlake | HealthLake | awsJson1_0 | 2017-07-01 | healthlake | healthlake |
| iam | IAM | awsQuery | 2010-05-08 | iam | iam |
| identitystore | identitystore | awsJson1_1 | 2020-06-15 | identitystore | identitystore |
| imagebuilder | imagebuilder | restJson1 | 2019-12-02 | imagebuilder | imagebuilder |
| inspector | Inspector | awsJson1_1 | 2016-02-16 | inspector | inspector |
| inspector-scan | Inspector Scan | restJson1 | 2023-08-08 | inspector-scan |  |
| inspector2 | Inspector2 | restJson1 | 2020-06-08 | inspector2 |  |
| internetmonitor | InternetMonitor | restJson1 | 2021-06-03 | internetmonitor |  |
| invoicing | Invoicing | awsJson1_0 | 2024-12-01 | invoicing | invoicing |
| iot | IoT | restJson1 | 2015-05-28 | iot | iot |
| iot-data-plane | IoT Data Plane | restJson1 | 2015-05-28 | iotdata | data-ats.iot |
| iot-events | IoT Events | restJson1 | 2018-07-27 | iotevents | iotevents |
| iot-events-data | IoT Events Data | restJson1 | 2018-10-23 | ioteventsdata | data.iotevents |
| iot-jobs-data-plane | IoT Jobs Data Plane | restJson1 | 2017-09-29 | iot-jobs-data | data.jobs.iot |
| iot-managed-integrations | IoT Managed Integrations | restJson1 | 2025-03-03 | iotmanagedintegrations | api.iotmanagedintegrations |
| iot-wireless | IoT Wireless | restJson1 | 2020-11-22 | iotwireless | api.iotwireless |
| iotanalytics | IoTAnalytics | restJson1 | 2017-11-27 | iotanalytics | iotanalytics |
| iotdeviceadvisor | IotDeviceAdvisor | restJson1 | 2020-09-18 | iotdeviceadvisor | api.iotdeviceadvisor |
| iotfleethub | IoTFleetHub | restJson1 | 2020-11-03 | iotfleethub | api.fleethub.iot |
| iotfleetwise | IoTFleetWise | awsJson1_0 | 2021-06-17 | iotfleetwise |  |
| iotsecuretunneling | IoTSecureTunneling | awsJson1_1 | 2018-10-05 | iotsecuredtunneling | api.tunneling.iot |
| iotsitewise | IoTSiteWise | restJson1 | 2019-12-02 | iotsitewise | iotsitewise |
| iotthingsgraph | IoTThingsGraph | awsJson1_1 | 2018-09-06 | iotthingsgraph | iotthingsgraph |
| iottwinmaker | IoTTwinMaker | restJson1 | 2021-11-29 |  | iottwinmaker |
| ivs | ivs | restJson1 | 2020-07-14 | ivs |  |
| ivs-realtime | IVS RealTime | restJson1 | 2020-07-14 | ivs | ivsrealtime |
| ivschat | ivschat | restJson1 | 2020-07-14 | ivschat |  |
| kafka | Kafka | restJson1 | 2018-11-14 | kafka | kafka |
| kafkaconnect | KafkaConnect | restJson1 | 2021-09-14 | kafkaconnect | kafkaconnect |
| kendra | kendra | awsJson1_1 | 2019-02-03 | kendra | kendra |
| kendra-ranking | Kendra Ranking | awsJson1_0 | 2022-10-19 | kendra-ranking | kendra-ranking |
| keyspaces | Keyspaces | awsJson1_0 | 2022-02-10 | cassandra | cassandra |
| keyspacesstreams | KeyspacesStreams | awsJson1_0 | 2024-09-09 | cassandra | cassandra-streams |
| kinesis | Kinesis | awsJson1_1 | 2013-12-02 | kinesis | kinesis |
| kinesis-analytics | Kinesis Analytics | awsJson1_1 | 2015-08-14 | kinesisanalytics | kinesisanalytics |
| kinesis-analytics-v2 | Kinesis Analytics V2 | awsJson1_1 | 2018-05-23 | kinesisanalytics | kinesisanalytics |
| kinesis-video | Kinesis Video | restJson1 | 2017-09-30 | kinesisvideo | kinesisvideo |
| kinesis-video-archived-media | Kinesis Video Archived Media | restJson1 | 2017-09-30 | kinesisvideo | kinesisvideo |
| kinesis-video-media | Kinesis Video Media | restJson1 | 2017-09-30 | kinesisvideo | kinesisvideo |
| kinesis-video-signaling | Kinesis Video Signaling | restJson1 | 2019-12-04 | kinesisvideo | kinesisvideo |
| kinesis-video-webrtc-storage | Kinesis Video WebRTC Storage | restJson1 | 2018-05-10 | kinesisvideo | kinesisvideo |
| kms | KMS | awsJson1_1 | 2014-11-01 | kms | kms |
| lakeformation | LakeFormation | restJson1 | 2017-03-31 | lakeformation | lakeformation |
| lambda | Lambda | restJson1 | 2015-03-31 | lambda | lambda |
| launch-wizard | Launch Wizard | restJson1 | 2018-05-10 | launchwizard | launchwizard |
| lex-model-building-service | Lex Model Building Service | restJson1 | 2017-04-19 | lex | models.lex |
| lex-models-v2 | Lex Models V2 | restJson1 | 2020-08-07 | lex | models-v2-lex |
| lex-runtime-service | Lex Runtime Service | restJson1 | 2016-11-28 | lex | runtime.lex |
| lex-runtime-v2 | Lex Runtime V2 | restJson1 | 2020-08-07 | lex | runtime-v2-lex |
| license-manager | License Manager | awsJson1_1 | 2018-08-01 | license-manager | license-manager |
| license-manager-linux-subscriptions | License Manager Linux Subscriptions | restJson1 | 2018-05-10 | license-manager-linux-subscriptions |  |
| license-manager-user-subscriptions | License Manager User Subscriptions | restJson1 | 2018-05-10 | license-manager-user-subscriptions |  |
| lightsail | Lightsail | awsJson1_1 | 2016-11-28 | lightsail | lightsail |
| location | Location | restJson1 | 2020-11-19 | geo |  |
| lookoutequipment | LookoutEquipment | awsJson1_0 | 2020-12-15 | lookoutequipment | lookoutequipment |
| lookoutmetrics | LookoutMetrics | restJson1 | 2017-07-25 | lookoutmetrics | lookoutmetrics |
| lookoutvision | LookoutVision | restJson1 | 2020-11-20 | lookoutvision | lookoutvision |
| m2 | m2 | restJson1 | 2021-04-28 | m2 | m2 |
| machine-learning | Machine Learning | awsJson1_1 | 2014-12-12 | machinelearning | machinelearning |
| macie2 | Macie2 | restJson1 | 2020-01-01 | macie2 | macie2 |
| mailmanager | MailManager | awsJson1_0 | 2023-10-17 | ses | mail-manager |
| managedblockchain | ManagedBlockchain | restJson1 | 2018-09-24 | managedblockchain | managedblockchain |
| managedblockchain-query | ManagedBlockchain Query | restJson1 | 2023-05-04 | managedblockchain-query |  |
| marketplace-agreement | Marketplace Agreement | awsJson1_0 | 2020-03-01 |  | agreement-marketplace |
| marketplace-catalog | Marketplace Catalog | restJson1 | 2018-09-17 | aws-marketplace | catalog.marketplace |
| marketplace-commerce-analytics | Marketplace Commerce Analytics | awsJson1_1 | 2015-07-01 | marketplacecommerceanalytics | marketplacecommerceanalytics |
| marketplace-deployment | Marketplace Deployment | restJson1 | 2023-01-25 | aws-marketplace | deployment-marketplace |
| marketplace-entitlement-service | Marketplace Entitlement Service | awsJson1_1 | 2017-01-11 | aws-marketplace | entitlement.marketplace |
| marketplace-metering | Marketplace Metering | awsJson1_1 | 2016-01-14 | aws-marketplace | metering.marketplace |
| marketplace-reporting | Marketplace Reporting | restJson1 | 2018-05-10 | aws-marketplace | reporting-marketplace |
| mediaconnect | MediaConnect | restJson1 | 2018-11-14 | mediaconnect |  |
| mediaconvert | MediaConvert | restJson1 | 2017-08-29 | mediaconvert | mediaconvert |
| medialive | MediaLive | restJson1 | 2017-10-14 | medialive | medialive |
| mediapackage | MediaPackage | restJson1 | 2017-10-12 | mediapackage | mediapackage |
| mediapackage-vod | MediaPackage Vod | restJson1 | 2018-11-07 | mediapackage-vod | mediapackage-vod |
| mediapackagev2 | MediaPackageV2 | restJson1 | 2022-12-25 | mediapackagev2 | mediapackagev2 |
| mediastore | MediaStore | awsJson1_1 | 2017-09-01 | mediastore | mediastore |
| mediastore-data | MediaStore Data | restJson1 | 2017-09-01 | mediastore | data.mediastore |
| mediatailor | MediaTailor | restJson1 | 2018-04-23 | mediatailor | api.mediatailor |
| medical-imaging | Medical Imaging | restJson1 | 2023-07-19 | medical-imaging | medical-imaging |
| memorydb | MemoryDB | awsJson1_1 | 2021-01-01 | memorydb | memory-db |
| mgn | mgn | restJson1 | 2020-02-26 | mgn |  |
| migration-hub | Migration Hub | awsJson1_1 | 2017-05-31 | mgh | mgh |
| migration-hub-refactor-spaces | Migration Hub Refactor Spaces | restJson1 | 2021-10-26 | refactor-spaces | refactor-spaces |
| migrationhub-config | MigrationHub Config | awsJson1_1 | 2019-06-30 | mgh | migrationhub-config |
| migrationhuborchestrator | MigrationHubOrchestrator | restJson1 | 2021-08-28 | migrationhub-orchestrator | migrationhub-orchestrator |
| migrationhubstrategy | MigrationHubStrategy | restJson1 | 2020-02-19 |  | migrationhub-strategy |
| mpa | MPA | restJson1 | 2022-07-26 | mpa |  |
| mq | mq | restJson1 | 2017-11-27 | mq | mq |
| mturk | MTurk | awsJson1_1 | 2017-01-17 | mturk-requester | mturk-requester |
| mwaa | MWAA | restJson1 | 2020-07-01 | airflow |  |
| neptune | Neptune | awsQuery | 2014-10-31 | rds | rds |
| neptune-graph | Neptune Graph | restJson1 | 2023-11-29 | neptune-graph |  |
| neptunedata | neptunedata | restJson1 | 2023-08-01 | neptune-db |  |
| network-firewall | Network Firewall | awsJson1_0 | 2020-11-12 | network-firewall | network-firewall |
| networkflowmonitor | NetworkFlowMonitor | restJson1 | 2023-04-19 | networkflowmonitor |  |
| networkmanager | NetworkManager | restJson1 | 2019-07-05 | networkmanager | networkmanager |
| networkmonitor | NetworkMonitor | restJson1 | 2023-08-01 | networkmonitor |  |
| notifications | Notifications | restJson1 | 2018-05-10 | notifications | notifications |
| notificationscontacts | NotificationsContacts | restJson1 | 2018-05-10 | notifications-contacts | notifications-contacts |
| oam | OAM | restJson1 | 2022-06-10 | oam |  |
| observabilityadmin | ObservabilityAdmin | restJson1 | 2018-05-10 | observabilityadmin |  |
| odb | odb | awsJson1_0 | 2024-08-20 | odb |  |
| omics | Omics | restJson1 | 2022-11-28 | omics |  |
| opensearch | OpenSearch | restJson1 | 2021-01-01 | es | es |
| opensearchserverless | OpenSearchServerless | awsJson1_0 | 2021-11-01 | aoss |  |
| opsworks | OpsWorks | awsJson1_1 | 2013-02-18 | opsworks | opsworks |
| opsworkscm | OpsWorksCM | awsJson1_1 | 2016-11-01 | opsworks-cm | opsworks-cm |
| organizations | Organizations | awsJson1_1 | 2016-11-28 | organizations | organizations |
| osis | OSIS | restJson1 | 2022-01-01 | osis | osis |
| outposts | Outposts | restJson1 | 2019-12-03 | outposts | outposts |
| panorama | Panorama | restJson1 | 2019-07-24 | panorama |  |
| partnercentral-selling | PartnerCentral Selling | awsJson1_0 | 2022-07-26 | partnercentral | partnercentral-selling |
| payment-cryptography | Payment Cryptography | awsJson1_0 | 2021-09-14 | payment-cryptography | controlplane.payment-cryptography |
| payment-cryptography-data | Payment Cryptography Data | restJson1 | 2022-02-03 |  | dataplane.payment-cryptography |
| pca-connector-ad | Pca Connector Ad | restJson1 | 2018-05-10 | pca-connector-ad |  |
| pca-connector-scep | Pca Connector Scep | restJson1 | 2018-05-10 | pca-connector-scep |  |
| pcs | PCS | awsJson1_0 | 2023-02-10 | pcs |  |
| personalize | Personalize | awsJson1_1 | 2018-05-22 | personalize | personalize |
| personalize-events | Personalize Events | restJson1 | 2018-03-22 | personalize | personalize-events |
| personalize-runtime | Personalize Runtime | restJson1 | 2018-05-22 | personalize | personalize-runtime |
| pi | PI | awsJson1_1 | 2018-02-27 | pi | pi |
| pinpoint | Pinpoint | restJson1 | 2016-12-01 | mobiletargeting | pinpoint |
| pinpoint-email | Pinpoint Email | restJson1 | 2018-07-26 | ses | email |
| pinpoint-sms-voice | Pinpoint SMS Voice | restJson1 | 2018-09-05 | sms-voice | sms-voice.pinpoint |
| pinpoint-sms-voice-v2 | Pinpoint SMS Voice V2 | awsJson1_0 | 2022-03-31 | sms-voice | sms-voice |
| pipes | Pipes | restJson1 | 2015-10-07 | pipes | pipes |
| polly | Polly | restJson1 | 2016-06-10 | polly | polly |
| pricing | Pricing | awsJson1_1 | 2017-10-15 | pricing | api.pricing |
| privatenetworks | PrivateNetworks | restJson1 | 2021-12-03 | private-networks |  |
| proton | Proton | awsJson1_0 | 2020-07-20 |  | proton |
| qapps | QApps | restJson1 | 2023-11-27 | qapps | data.qapps |
| qbusiness | QBusiness | restJson1 | 2023-11-27 | qbusiness |  |
| qconnect | QConnect | restJson1 | 2020-10-19 | wisdom |  |
| qldb | QLDB | restJson1 | 2019-01-02 | qldb | qldb |
| qldb-session | QLDB Session | awsJson1_0 | 2019-07-11 | qldb | session.qldb |
| quicksight | QuickSight | restJson1 | 2018-04-01 | quicksight | quicksight |
| ram | RAM | restJson1 | 2018-01-04 | ram | ram |
| rbin | rbin | restJson1 | 2021-06-15 | rbin | rbin |
| rds | RDS | awsQuery | 2014-10-31 | rds | rds |
| rds-data | RDS Data | restJson1 | 2018-08-01 | rds-data |  |
| redshift | Redshift | awsQuery | 2012-12-01 | redshift | redshift |
| redshift-data | Redshift Data | awsJson1_1 | 2019-12-20 | redshift-data |  |
| redshift-serverless | Redshift Serverless | awsJson1_1 | 2021-04-21 | redshift-serverless |  |
| rekognition | Rekognition | awsJson1_1 | 2016-06-27 | rekognition | rekognition |
| repostspace | repostspace | restJson1 | 2022-05-13 | repostspace |  |
| resiliencehub | resiliencehub | restJson1 | 2020-04-30 | resiliencehub | resiliencehub |
| resource-explorer-2 | Resource Explorer 2 | restJson1 | 2022-07-28 | resource-explorer-2 | resource-explorer-2 |
| resource-groups | Resource Groups | restJson1 | 2017-11-27 | resource-groups | resource-groups |
| resource-groups-tagging-api | Resource Groups Tagging API | awsJson1_1 | 2017-01-26 | tagging | tagging |
| robomaker | RoboMaker | restJson1 | 2018-06-29 | robomaker | robomaker |
| rolesanywhere | RolesAnywhere | restJson1 | 2018-05-10 | rolesanywhere |  |
| route-53 | Route 53 | restXml | 2013-04-01 | route53 | route53 |
| route-53-domains | Route 53 Domains | awsJson1_1 | 2014-05-15 | route53domains | route53domains |
| route53-recovery-cluster | Route53 Recovery Cluster | awsJson1_0 | 2019-12-02 | route53-recovery-cluster | route53-recovery-cluster |
| route53-recovery-control-config | Route53 Recovery Control Config | restJson1 | 2020-11-02 | route53-recovery-control-config | route53-recovery-control-config |
| route53-recovery-readiness | Route53 Recovery Readiness | restJson1 | 2019-12-02 | route53-recovery-readiness | route53-recovery-readiness |
| route53profiles | Route53Profiles | restJson1 | 2018-05-10 | route53profiles |  |
| route53resolver | Route53Resolver | awsJson1_1 | 2018-04-01 | route53resolver | route53resolver |
| rum | RUM | restJson1 | 2018-05-10 | rum |  |
| s3 | S3 | restXml | 2006-03-01 | s3 | s3 |
| s3-control | S3 Control | restXml | 2018-08-20 | s3 | s3-control |
| s3outposts | S3Outposts | restJson1 | 2017-07-25 | s3-outposts | s3-outposts |
| s3tables | S3Tables | restJson1 | 2018-05-10 | s3tables |  |
| s3vectors | S3Vectors | restJson1 | 2025-07-15 | s3vectors | s3vectors |
| sagemaker | SageMaker | awsJson1_1 | 2017-07-24 | sagemaker | api.sagemaker |
| sagemaker-a2i-runtime | SageMaker A2I Runtime | restJson1 | 2019-11-07 | sagemaker | a2i-runtime.sagemaker |
| sagemaker-edge | Sagemaker Edge | restJson1 | 2020-09-23 | sagemaker | edge.sagemaker |
| sagemaker-featurestore-runtime | SageMaker FeatureStore Runtime | restJson1 | 2020-07-01 | sagemaker | featurestore-runtime.sagemaker |
| sagemaker-geospatial | SageMaker Geospatial | restJson1 | 2020-05-27 | sagemaker-geospatial |  |
| sagemaker-metrics | SageMaker Metrics | restJson1 | 2022-09-30 | sagemaker | metrics.sagemaker |
| sagemaker-runtime | SageMaker Runtime | restJson1 | 2017-05-13 | sagemaker | runtime.sagemaker |
| savingsplans | savingsplans | restJson1 | 2019-06-28 | savingsplans | savingsplans |
| scheduler | Scheduler | restJson1 | 2021-06-30 | scheduler |  |
| schemas | schemas | restJson1 | 2019-12-02 | schemas | schemas |
| secrets-manager | Secrets Manager | awsJson1_1 | 2017-10-17 | secretsmanager | secretsmanager |
| security-ir | Security IR | restJson1 | 2018-05-10 | security-ir |  |
| securityhub | SecurityHub | restJson1 | 2018-10-26 | securityhub | securityhub |
| securitylake | SecurityLake | restJson1 | 2018-05-10 | securitylake |  |
| serverlessapplicationrepository | ServerlessApplicationRepository | restJson1 | 2017-09-08 | serverlessrepo | serverlessrepo |
| service-catalog | Service Catalog | awsJson1_1 | 2015-12-10 | servicecatalog | servicecatalog |
| service-catalog-appregistry | Service Catalog AppRegistry | restJson1 | 2020-06-24 | servicecatalog | servicecatalog-appregistry |
| service-quotas | Service Quotas | awsJson1_1 | 2019-06-24 | servicequotas | servicequotas |
| servicediscovery | ServiceDiscovery | awsJson1_1 | 2017-03-14 | servicediscovery | servicediscovery |
| ses | SES | awsQuery | 2010-12-01 | ses | email |
| sesv2 | SESv2 | restJson1 | 2019-09-27 | ses | email |
| sfn | SFN | awsJson1_0 | 2016-11-23 | states | states |
| shield | Shield | awsJson1_1 | 2016-06-02 | shield | shield |
| signer | signer | restJson1 | 2017-08-25 | signer | signer |
| simspaceweaver | SimSpaceWeaver | restJson1 | 2022-10-28 | simspaceweaver | simspaceweaver |
| sms | SMS | awsJson1_1 | 2016-10-24 | sms | sms |
| snow-device-management | Snow Device Management | restJson1 | 2021-08-04 | snow-device-management |  |
| snowball | Snowball | awsJson1_1 | 2016-06-30 | snowball | snowball |
| sns | SNS | awsQuery | 2010-03-31 | sns | sns |
| socialmessaging | SocialMessaging | restJson1 | 2024-01-01 | social-messaging | social-messaging |
| sqs | SQS | awsJson1_0 | 2012-11-05 | sqs | sqs |
| ssm | SSM | awsJson1_1 | 2014-11-06 | ssm | ssm |
| ssm-contacts | SSM Contacts | awsJson1_1 | 2021-05-03 | ssm-contacts | ssm-contacts |
| ssm-guiconnect | SSM GuiConnect | restJson1 | 2021-05-01 | ssm-guiconnect |  |
| ssm-incidents | SSM Incidents | restJson1 | 2018-05-10 | ssm-incidents |  |
| ssm-quicksetup | SSM QuickSetup | restJson1 | 2018-05-10 | ssm-quicksetup |  |
| ssm-sap | Ssm Sap | restJson1 | 2018-05-10 | ssm-sap | ssm-sap |
| sso | SSO | restJson1 | 2019-06-10 | awsssoportal | portal.sso |
| sso-admin | SSO Admin | awsJson1_1 | 2020-07-20 | sso | sso |
| sso-oidc | SSO OIDC | restJson1 | 2019-06-10 | sso-oauth | oidc |
| storage-gateway | Storage Gateway | awsJson1_1 | 2013-06-30 | storagegateway | storagegateway |
| sts | STS | awsQuery | 2011-06-15 | sts | sts |
| supplychain | SupplyChain | restJson1 | 2024-01-01 | scn | scn |
| support | Support | awsJson1_1 | 2013-04-15 | support | support |
| support-app | Support App | restJson1 | 2021-08-20 | supportapp |  |
| swf | SWF | awsJson1_0 | 2012-01-25 | swf | swf |
| synthetics | synthetics | restJson1 | 2017-10-11 | synthetics | synthetics |
| taxsettings | TaxSettings | restJson1 | 2018-05-10 | tax |  |
| textract | Textract | awsJson1_1 | 2018-06-27 | textract | textract |
| timestream-influxdb | Timestream InfluxDB | awsJson1_0 | 2023-01-27 | timestream-influxdb |  |
| timestream-query | Timestream Query | awsJson1_0 | 2018-11-01 | timestream | query.timestream |
| timestream-write | Timestream Write | awsJson1_0 | 2018-11-01 | timestream | ingest.timestream |
| tnb | tnb | restJson1 | 2008-10-21 | tnb |  |
| transcribe | Transcribe | awsJson1_1 | 2017-10-26 | transcribe | transcribe |
| transcribe-streaming | Transcribe Streaming | restJson1 | 2017-10-26 | transcribe | transcribestreaming |
| transfer | Transfer | awsJson1_1 | 2018-11-05 | transfer | transfer |
| translate | Translate | awsJson1_1 | 2017-07-01 | translate | translate |
| trustedadvisor | TrustedAdvisor | restJson1 | 2022-09-15 | trustedadvisor |  |
| verifiedpermissions | VerifiedPermissions | awsJson1_0 | 2021-12-01 | verifiedpermissions | verifiedpermissions |
| voice-id | Voice ID | awsJson1_0 | 2021-09-27 | voiceid | voiceid |
| vpc-lattice | VPC Lattice | restJson1 | 2022-11-30 | vpc-lattice |  |
| waf | WAF | awsJson1_1 | 2015-08-24 | waf | waf |
| waf-regional | WAF Regional | awsJson1_1 | 2016-11-28 | waf-regional | waf-regional |
| wafv2 | WAFV2 | awsJson1_1 | 2019-07-29 | wafv2 | wafv2 |
| wellarchitected | WellArchitected | restJson1 | 2020-03-31 | wellarchitected | wellarchitected |
| wisdom | Wisdom | restJson1 | 2020-10-19 | wisdom |  |
| workdocs | WorkDocs | restJson1 | 2016-05-01 | workdocs | workdocs |
| workmail | WorkMail | awsJson1_1 | 2017-10-01 | workmail | workmail |
| workmailmessageflow | WorkMailMessageFlow | restJson1 | 2019-05-01 | workmailmessageflow | workmailmessageflow |
| workspaces | WorkSpaces | awsJson1_1 | 2015-04-08 | workspaces | workspaces |
| workspaces-instances | Workspaces Instances | awsJson1_0 | 2022-07-26 | workspaces-instances |  |
| workspaces-thin-client | WorkSpaces Thin Client | restJson1 | 2023-08-22 | thinclient |  |
| workspaces-web | WorkSpaces Web | restJson1 | 2020-07-08 | workspaces-web | workspaces-web |
| xray | XRay | restJson1 | 2016-04-12 | xray | xray |

---

*Generated on 2025-08-05 by itty-aws service support table generator*
