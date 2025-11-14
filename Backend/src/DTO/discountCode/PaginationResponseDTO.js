// dtos/common/PaginationResponseDTO.js
class PaginationResponseDTO {
  constructor(items, pagination) {
    this.items = items;
    this.pagination = pagination;
  }
}

module.exports = PaginationResponseDTO;
