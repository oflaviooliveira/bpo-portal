# Upload Endpoints Documentation

## Overview

This document describes the available upload endpoints in the BPO Portal system. The system supports multiple upload endpoints for different types of documents and files.

## Authentication

All upload endpoints require authentication via session cookies. Users must be logged in through the `/api/login` endpoint before accessing upload functionality.

## Available Endpoints

### 1. File Upload Endpoint

**Endpoint:** `POST /api/file/upload`

**Description:** General file upload endpoint for various document types.

**Authentication:** Required (session-based)

**Request Format:**
- Content-Type: `multipart/form-data`
- Method: POST

**Parameters:**
- `file` (required): The file to upload
- `documentType` (required): Type of document being uploaded
- `contraparte` (required): Associated counterpart/entity name

**Supported File Types:**
- PDF (.pdf)
- Images: JPG, JPEG, PNG, GIF, WebP

**Example Request:**
```bash
curl -X POST http://localhost:3001/api/file/upload \
  -H "Cookie: connect.sid=your-session-cookie" \
  -F "file=@document.pdf" \
  -F "documentType=invoice" \
  -F "contraparte=Supplier ABC"
```

**Success Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "fileId": "uuid-here",
  "filename": "document.pdf"
}
```

**Error Responses:**
- `401 Unauthorized`: User not authenticated
- `400 Bad Request`: Missing required parameters or invalid file type
- `500 Internal Server Error`: Server processing error

---

### 2. Documents Upload Endpoint

**Endpoint:** `POST /api/documents/upload`

**Description:** Specialized endpoint for document management with additional metadata requirements.

**Authentication:** Required (session-based)

**Request Format:**
- Content-Type: `multipart/form-data`
- Method: POST

**Parameters:**
- `file` (required): The document file to upload
- `documentType` (required): Type of document
- `contraparte` (required): Associated counterpart/entity
- `competenceDate` (required): Document competence date
- `paidDate` (required): Payment date

**Supported File Types:**
- PDF (.pdf)
- Images: JPG, JPEG, PNG, GIF, WebP

**Example Request:**
```bash
curl -X POST http://localhost:3001/api/documents/upload \
  -H "Cookie: connect.sid=your-session-cookie" \
  -F "file=@invoice.pdf" \
  -F "documentType=invoice" \
  -F "contraparte=Client XYZ" \
  -F "competenceDate=2025-01-15" \
  -F "paidDate=2025-01-20"
```

**Success Response:**
```json
{
  "success": true,
  "message": "Document uploaded and processed successfully",
  "documentId": "uuid-here",
  "filename": "invoice.pdf",
  "metadata": {
    "documentType": "invoice",
    "contraparte": "Client XYZ",
    "competenceDate": "2025-01-15",
    "paidDate": "2025-01-20"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: User not authenticated
- `400 Bad Request`: Missing required fields (competenceDate, paidDate) or invalid data
- `500 Internal Server Error`: Server processing error

---

## File Processing Pipeline

### Upload Flow
1. **Authentication Check**: Verify user session
2. **File Validation**: Check file type and size limits
3. **Metadata Processing**: Extract and validate metadata
4. **Storage**: Save file to configured storage location
5. **Database Record**: Create database entry with file metadata
6. **OCR Processing**: (If applicable) Extract text content
7. **AI Analysis**: (If applicable) Analyze document content

### Storage Configuration
- **Local Storage**: Files stored in `uploads/` directory
- **Cloud Storage**: Integration available for cloud providers
- **File Naming**: UUID-based naming to prevent conflicts

## Security Considerations

### File Type Validation
- Only whitelisted file extensions are allowed
- MIME type validation is performed
- File content scanning for malicious content

### Size Limits
- Maximum file size: 10MB per file
- Maximum total upload size per request: 50MB

### Access Control
- Multi-tenant isolation enforced
- Role-based access control (RBAC)
- Row Level Security (RLS) policies applied

## Error Handling

### Common Error Codes
- `400`: Bad Request - Invalid parameters or file format
- `401`: Unauthorized - Authentication required
- `403`: Forbidden - Insufficient permissions
- `413`: Payload Too Large - File size exceeds limits
- `415`: Unsupported Media Type - Invalid file type
- `500`: Internal Server Error - Server processing error

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
```

## Testing

### Manual Testing
Use the provided curl examples above with valid session cookies obtained from the login endpoint.

### Automated Testing
Refer to the TestSprite test report for comprehensive endpoint testing results:
- Location: `testsprite_tests/testsprite-mcp-test-report.md`
- Coverage: Authentication, file upload, and document processing workflows

## Troubleshooting

### Common Issues

1. **401 Unauthorized Error**
   - Ensure user is logged in via `/api/login`
   - Check session cookie is included in request
   - Verify session hasn't expired

2. **400 Bad Request - Missing Fields**
   - For `/api/documents/upload`: Include `competenceDate` and `paidDate`
   - Verify all required fields are present

3. **File Upload Failures**
   - Check file type is supported
   - Verify file size is within limits
   - Ensure proper multipart/form-data encoding

### Debug Steps
1. Check server logs for detailed error messages
2. Verify authentication status with `/api/user` endpoint
3. Test with minimal valid payload first
4. Validate file format and size requirements

## Related Documentation

- [Authentication API](./auth-endpoints.md)
- [File Management API](./file-management.md)
- [OCR Processing](./ocr-processing.md)
- [AI Integration](./ai-integration.md)

---

**Last Updated:** January 17, 2025  
**Version:** 1.0.0  
**Maintainer:** Development Team