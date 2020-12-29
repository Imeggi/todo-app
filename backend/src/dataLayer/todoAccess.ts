import * as AWS  from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { createLogger } from '../utils/logger'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest'

const XAWS = AWSXRay.captureAWS(AWS)

import { TodoItem } from '../models/TodoItem'
import { String } from 'aws-sdk/clients/apigateway'

const bucketName = process.env.IMAGES_S3_BUCKET
const urlExpiration = process.env.SIGNED_URL_EXPIRATION
const logger = createLogger('todoAccess')
export class TodoAccess {

  constructor(
    private readonly docClient: DocumentClient = createDynamoDBClient(),
    private readonly s3 = createS3Client(), 
    private readonly todosTable = process.env.TODOS_TABLE) {
  }
  
  async getAllTodos(userId: String): Promise<TodoItem[]> {
    logger.info('Getting all groups')

    const result = await this.docClient.query({
      TableName: this.todosTable,
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: {
        ":u": userId
    }
    }).promise()

      const items = result.Items
      logger.info('Returning list of items', { items })
      return items as TodoItem[]
  
  }

  async createTodoItem(todoItem: TodoItem): Promise<TodoItem>{
    logger.info('Putting a new todo in DyamoDB', { todoItem })
    await this.docClient.put({
      TableName: this.todosTable, 
      Item: todoItem
    }).promise()
logger.info('Returning the created todo', { todoItem })
   return todoItem as TodoItem
  }

  async deleteTodoItem(userId: string, todoId: string): Promise<string>{
    logger.info('requesting to dynamo db to delete a todoItem', { todoId })
 
    await this.docClient.delete({
        TableName: this.todosTable,
        Key: {
          "userId": userId,
          "todoId": todoId
        }
    }).promise()
    logger.info('TodoItem deleted', { todoId })
    return 
  }

  async updateTodoItem(userId: string, todoId: string, updatedTodo: UpdateTodoRequest ): Promise<string>{
    logger.info('requesting to dynamo db to update a todoItem', { todoId })
 
    await this.docClient.update({
        TableName: this.todosTable,
        Key: {
          "userId": userId,
          "todoId": todoId
        },
        UpdateExpression: "set #name = :n, dueDate = :dd, done = :d",
    ExpressionAttributeValues:{
        ":n": updatedTodo.name,
        ":dd": updatedTodo.dueDate,
        ":d":updatedTodo.done
    },
    ExpressionAttributeNames: {
        "#name": "name"
    },
    ReturnValues:"UPDATED_NEW"
    }).promise()

    logger.info('TodoItem updated', { updatedTodo })
    return 
  }

  async generateUploadUrl(todoId: string, userId: string): Promise<string> {
      logger.info('generating upload url')
      const url = await this.s3.getSignedUrl('putObject', {
        Bucket: bucketName,
        Key: todoId,
        Expires: urlExpiration
      })

      logger.info('the url is:', { url })

      await this.docClient.update({
        TableName: this.todosTable,
        Key: {
          "userId": userId,
          "todoId": todoId
        },
        UpdateExpression: "set attachmentUrl = :image",
        ExpressionAttributeValues:{
          ":image": `https://${bucketName}.s3.amazonaws.com/${todoId}`        
    },
    ReturnValues:"UPDATED_NEW"
    }).promise()

    return url
  }
  

}

function createDynamoDBClient() {
    /*if (process.env.IS_OFFLINE) {
      logger.info('Creating a local DynamoDB instance')
      return new XAWS.DynamoDB.DocumentClient({
        region: 'localhost',
        endpoint: 'http://localhost:8000'
      })
    }*/
    logger.info('creating DynamoDB Client')
    return new XAWS.DynamoDB.DocumentClient()
  }

  function createS3Client() {
    logger.info('creating s3 Client')
    return new XAWS.S3({
        signatureVersion: 'v4'
      })
  }