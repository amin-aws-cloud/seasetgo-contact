variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "eu-west-2"
}

variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
  default     = "seasetgo"
}

variable "business_email" {
  description = "Business email for receiving inquiry notifications"
  type        = string
}

variable "sender_email" {
  description = "Email address used to send automated emails (FROM address)"
  type        = string
}

