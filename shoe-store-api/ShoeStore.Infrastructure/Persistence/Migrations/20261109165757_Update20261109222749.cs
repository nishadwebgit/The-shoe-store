using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShoeStore.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Update20261109222749 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LowStockThreshold",
                table: "ProductVariants",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StorageKey",
                table: "ProductImages",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ChangedById",
                table: "OrderStatusHistory",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ChangedByName",
                table: "OrderStatusHistory",
                type: "nvarchar(130)",
                maxLength: 130,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AdminAuditLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Action = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    EntityId = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Summary = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    PerformedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PerformedByName = table.Column<string>(type: "nvarchar(130)", maxLength: 130, nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminAuditLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StoreSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    LowStockThreshold = table.Column<int>(type: "int", nullable: false),
                    CatalogSeededUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedByName = table.Column<string>(type: "nvarchar(130)", maxLength: 130, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StoreSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Suppliers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    ContactName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Suppliers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StockReceipts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ReceiptNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ClientRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SupplierId = table.Column<int>(type: "int", nullable: true),
                    SupplierName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    SupplierReference = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    ReceivedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ProductId = table.Column<int>(type: "int", nullable: true),
                    ProductCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ProductName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    SellingPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TotalQuantity = table.Column<int>(type: "int", nullable: false),
                    ReceivedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReceivedByName = table.Column<string>(type: "nvarchar(130)", maxLength: 130, nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockReceipts", x => x.Id);
                    table.CheckConstraint("CK_StockReceipts_Quantity", "[TotalQuantity] > 0");
                    table.ForeignKey(
                        name: "FK_StockReceipts_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StockReceipts_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InventoryTransactions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProductVariantId = table.Column<int>(type: "int", nullable: true),
                    Sku = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    ProductCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ProductName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ColourName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Size = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    QuantityChange = table.Column<int>(type: "int", nullable: false),
                    PreviousQuantity = table.Column<int>(type: "int", nullable: false),
                    NewQuantity = table.Column<int>(type: "int", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    StockReceiptId = table.Column<int>(type: "int", nullable: true),
                    PerformedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PerformedByName = table.Column<string>(type: "nvarchar(130)", maxLength: 130, nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryTransactions", x => x.Id);
                    table.CheckConstraint("CK_InventoryTransactions_Change", "[QuantityChange] <> 0 AND [NewQuantity] = [PreviousQuantity] + [QuantityChange]");
                    table.CheckConstraint("CK_InventoryTransactions_NonNegative", "[NewQuantity] >= 0 AND [PreviousQuantity] >= 0");
                    table.ForeignKey(
                        name: "FK_InventoryTransactions_ProductVariants_ProductVariantId",
                        column: x => x.ProductVariantId,
                        principalTable: "ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_InventoryTransactions_StockReceipts_StockReceiptId",
                        column: x => x.StockReceiptId,
                        principalTable: "StockReceipts",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "StockReceiptItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StockReceiptId = table.Column<int>(type: "int", nullable: false),
                    ProductVariantId = table.Column<int>(type: "int", nullable: true),
                    Sku = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    ColourName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Size = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    PreviousQuantity = table.Column<int>(type: "int", nullable: false),
                    NewQuantity = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockReceiptItems", x => x.Id);
                    table.CheckConstraint("CK_StockReceiptItems_Quantity", "[Quantity] > 0");
                    table.ForeignKey(
                        name: "FK_StockReceiptItems_ProductVariants_ProductVariantId",
                        column: x => x.ProductVariantId,
                        principalTable: "ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StockReceiptItems_StockReceipts_StockReceiptId",
                        column: x => x.StockReceiptId,
                        principalTable: "StockReceipts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "StoreSettings",
                columns: new[] { "Id", "CatalogSeededUtc", "LowStockThreshold", "ModifiedByName", "ModifiedUtc" },
                values: new object[] { 1, null, 3, null, null });

            migrationBuilder.AddCheckConstraint(
                name: "CK_ProductVariants_LowStockThreshold",
                table: "ProductVariants",
                sql: "[LowStockThreshold] IS NULL OR [LowStockThreshold] >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_ProductImages_StorageKey",
                table: "ProductImages",
                column: "StorageKey");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_PlacedUtc",
                table: "Orders",
                column: "PlacedUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_Status_PlacedUtc",
                table: "Orders",
                columns: new[] { "Status", "PlacedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_AdminAuditLogs_CreatedUtc",
                table: "AdminAuditLogs",
                column: "CreatedUtc");

            migrationBuilder.CreateIndex(
                name: "IX_AdminAuditLogs_EntityType_EntityId",
                table: "AdminAuditLogs",
                columns: new[] { "EntityType", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_CreatedUtc",
                table: "InventoryTransactions",
                column: "CreatedUtc");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_ProductCode",
                table: "InventoryTransactions",
                column: "ProductCode");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_ProductVariantId_CreatedUtc",
                table: "InventoryTransactions",
                columns: new[] { "ProductVariantId", "CreatedUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_Reference",
                table: "InventoryTransactions",
                column: "Reference");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_StockReceiptId",
                table: "InventoryTransactions",
                column: "StockReceiptId");

            migrationBuilder.CreateIndex(
                name: "IX_StockReceiptItems_ProductVariantId",
                table: "StockReceiptItems",
                column: "ProductVariantId");

            migrationBuilder.CreateIndex(
                name: "IX_StockReceiptItems_StockReceiptId",
                table: "StockReceiptItems",
                column: "StockReceiptId");

            migrationBuilder.CreateIndex(
                name: "IX_StockReceipts_ClientRequestId",
                table: "StockReceipts",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StockReceipts_CreatedUtc",
                table: "StockReceipts",
                column: "CreatedUtc");

            migrationBuilder.CreateIndex(
                name: "IX_StockReceipts_ProductId",
                table: "StockReceipts",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_StockReceipts_ReceiptNumber",
                table: "StockReceipts",
                column: "ReceiptNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StockReceipts_SupplierId_SupplierReference",
                table: "StockReceipts",
                columns: new[] { "SupplierId", "SupplierReference" },
                unique: true,
                filter: "[SupplierId] IS NOT NULL AND [SupplierReference] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Suppliers_Name",
                table: "Suppliers",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminAuditLogs");

            migrationBuilder.DropTable(
                name: "InventoryTransactions");

            migrationBuilder.DropTable(
                name: "StockReceiptItems");

            migrationBuilder.DropTable(
                name: "StoreSettings");

            migrationBuilder.DropTable(
                name: "StockReceipts");

            migrationBuilder.DropTable(
                name: "Suppliers");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ProductVariants_LowStockThreshold",
                table: "ProductVariants");

            migrationBuilder.DropIndex(
                name: "IX_ProductImages_StorageKey",
                table: "ProductImages");

            migrationBuilder.DropIndex(
                name: "IX_Orders_PlacedUtc",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_Status_PlacedUtc",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "LowStockThreshold",
                table: "ProductVariants");

            migrationBuilder.DropColumn(
                name: "StorageKey",
                table: "ProductImages");

            migrationBuilder.DropColumn(
                name: "ChangedById",
                table: "OrderStatusHistory");

            migrationBuilder.DropColumn(
                name: "ChangedByName",
                table: "OrderStatusHistory");
        }
    }
}
