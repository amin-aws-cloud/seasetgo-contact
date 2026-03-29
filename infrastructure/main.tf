provider "aws" {
  region = var.aws_region
}

// S3 bucket for hosting static website content (e.g., contact form)
resource "aws_s3_bucket" "contact" {
  bucket = "seasetgo-contact"
}

// Configure the S3 bucket for static website hosting
resource "aws_s3_bucket_website_configuration" "contact_website" {
  bucket = aws_s3_bucket.contact.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }
}

// Disable block public access (required for public website hosting)
resource "aws_s3_bucket_public_access_block" "contact_public_access" {
  bucket = aws_s3_bucket.contact.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

// Bucket policy to allow public read access to the S3 bucket
resource "aws_s3_bucket_policy" "contact_policy" {
  bucket = aws_s3_bucket.contact.id

  depends_on = [aws_s3_bucket_public_access_block.contact_public_access] 

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.contact.arn}/*"
      }
    ]
  })
}

// DynamoDB table for storing contact form submissions
resource "aws_dynamodb_table" "contact_submissions" {
  name         = "contact_submissions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  // NOTE: DynamoDB only requires attributes used in keys or indexes
  // Other attributes (Name, Email, Message, Timestamp, ReferenceNumber) are added dynamically
  // Do NOT define them here unless they're part of a key or index

  ttl {
    attribute_name = "TTL"
    enabled        = false
  }
}

// IAM policy to allow Lambda to assume role
data "aws_iam_policy_document" "lambda_assume_role_policy" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

// IAM role for Lambda function
resource "aws_iam_role" "lambda_execution_role" {
  name               = "lambda_execution_role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role_policy.json
}

// IAM policy for Lambda to access DynamoDB
resource "aws_iam_role_policy" "lambda_dynamodb_policy" {
  name = "lambda_dynamodb_policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ]
        Resource = aws_dynamodb_table.contact_submissions.arn
      }
    ]
  })
}

// IAM policy for Lambda to send emails via SES
resource "aws_iam_role_policy" "lambda_ses_policy" {
  name = "lambda_ses_policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail", 
          "ses:SendRawEmail" 
        ]
        Resource = "*"
      }
    ]
  })
}

// IAM policy for Lambda CloudWatch Logs (best practice)
resource "aws_iam_role_policy_attachment" "lambda_logs_policy" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

// Lambda function to process contact form submissions
resource "aws_lambda_function" "contact_handler" {
  function_name    = "contact_handler"
  role             = aws_iam_role.lambda_execution_role.arn
  runtime          = "nodejs18.x" 
  handler          = "index.handler"
  filename         = "${path.module}/function.zip" 
  source_code_hash = filebase64sha256("${path.module}/function.zip") 

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.contact_submissions.name
      BUSINESS_EMAIL = var.business_email
      SENDER_EMAIL   = var.sender_email
    }
  }

  timeout     = 30
  memory_size = 256
}

// API Gateway REST API
resource "aws_api_gateway_rest_api" "contact_api" {
  name        = "ContactAPI"
  description = "API for handling contact form submissions and storing them in DynamoDB"

  body = jsonencode({
    openapi = "3.0.1"
    info = {
      title   = "Contact API"
      version = "1.0"
    }
    paths = {
      "/submit" = {
        post = {
          x-amazon-apigateway-integration = {
            uri        = aws_lambda_function.contact_handler.invoke_arn
            httpMethod = "POST"
            type       = "aws_proxy"
          }
        }
        options = {
          x-amazon-apigateway-integration = {
            type = "mock"
            requestTemplates = {
              "application/json" = "{\"statusCode\": 200}"
            }
            responses = {
              default = {
                statusCode = "200"
                responseParameters = {
                  "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'"
                  "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
                  "method.response.header.Access-Control-Allow-Origin"  = "'*'"
                }
              }
            }
          }
          responses = {
            "200" = {
              description = "CORS response"
              headers = {
                "Access-Control-Allow-Origin" = {
                  schema = { type = "string" }
                }
                "Access-Control-Allow-Methods" = {
                  schema = { type = "string" }
                }
                "Access-Control-Allow-Headers" = {
                  schema = { type = "string" }
                }
              }
            }
          }
        }
      }
    }
  })
}

// API Gateway deployment 
resource "aws_api_gateway_deployment" "contact_api_deployment" {
  rest_api_id = aws_api_gateway_rest_api.contact_api.id

  triggers = {
    redeployment = sha1(jsonencode(aws_api_gateway_rest_api.contact_api.body))
  }

  lifecycle {
    create_before_destroy = true
  }
}

// API Gateway stage
resource "aws_api_gateway_stage" "contact_api_stage" {
  deployment_id = aws_api_gateway_deployment.contact_api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.contact_api.id
  stage_name    = "dev"
}

// Lambda permission for API Gateway to invoke Lambda
resource "aws_lambda_permission" "api_gateway_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.contact_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.contact_api.execution_arn}/*/*"
}

// SES email identity for sender email
resource "aws_ses_email_identity" "sender_email" {
  email = var.sender_email
}

// SES email identity for business email (optional, but recommended)
resource "aws_ses_email_identity" "business_email" {
  email = var.business_email
}

// Outputs
output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = "${aws_api_gateway_stage.contact_api_stage.invoke_url}/submit"
}

output "s3_website_endpoint" {
  description = "S3 website endpoint"
  value       = aws_s3_bucket_website_configuration.contact_website.website_endpoint
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.contact_submissions.name
}