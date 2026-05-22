export const stats = [
  { label: "Đơn hàng hôm nay", value: "128" },
  { label: "Doanh thu", value: "245,000,000 VND" },
  { label: "Khách hàng mới", value: "36" },
  { label: "Sản phẩm sắp hết", value: "9" },
];

export const latestOrders = [
  {
    id: "#OD1021",
    customer: "Nguyễn Minh Anh",
    item: "Nhẫn vàng 18K",
    total: "8,900,000 VND",
    status: "Đang xử lý",
  },
  {
    id: "#OD1020",
    customer: "Trần Hoài Nam",
    item: "Dây chuyền bạc",
    total: "2,450,000 VND",
    status: "Đã giao",
  },
  {
    id: "#OD1019",
    customer: "Lê Bảo Châu",
    item: "Bông tai ngọc",
    total: "3,200,000 VND",
    status: "Chờ xác nhận",
  },
];

export const customerStats = [
  { label: "Tổng khách hàng", value: "2,480" },
  { label: "Khách VIP", value: "184" },
  { label: "Mới trong 30 ngày", value: "327" },
];

export const customerList = [
  {
    id: "KH001",
    name: "Phạm Nhật Linh",
    email: "linh.pham@example.com",
    orders: 12,
    spend: "58,200,000 VND",
    level: "VIP",
  },
  {
    id: "KH002",
    name: "Đoàn Thanh Hà",
    email: "ha.doan@example.com",
    orders: 5,
    spend: "16,450,000 VND",
    level: "Thân thiết",
  },
  {
    id: "KH003",
    name: "Bùi Quốc Bảo",
    email: "bao.bui@example.com",
    orders: 2,
    spend: "4,900,000 VND",
    level: "Mới",
  },
];

export const categoryRecords = [
  { id: 1, name: "Vàng", parent_id: null },
  { id: 2, name: "Bạc", parent_id: null },
  { id: 3, name: "Kim cương", parent_id: null },
  { id: 4, name: "Bạch kim", parent_id: null },
  { id: 5, name: "Nhẫn vàng", parent_id: 1 },
  { id: 6, name: "Dây chuyền vàng", parent_id: 1 },
  { id: 7, name: "Lắc vàng", parent_id: 1 },
  { id: 8, name: "Nhẫn bạc", parent_id: 2 },
  { id: 9, name: "Dây chuyền bạc", parent_id: 2 },
  { id: 10, name: "Lắc bạc", parent_id: 2 },
  { id: 11, name: "Nhẫn kim cương", parent_id: 3 },
  { id: 12, name: "Dây chuyền kim cương", parent_id: 3 },
  { id: 13, name: "Bông tai kim cương", parent_id: 3 },
  { id: 14, name: "Nhẫn bạch kim", parent_id: 4 },
  { id: 15, name: "Dây chuyền bạch kim", parent_id: 4 },
  { id: 16, name: "Lắc bạch kim", parent_id: 4 },
];

export const products = [
  {
    id: 1,
    category_id: 5,
    name: "Nhẫn vàng 18K đính CZ",
    description:
      "Nhẫn trang sức thiết kế thanh lịch, phù hợp sử dụng hằng ngày và quà tặng.",
    material_type: "Vàng 18K",
    base_weight: 3.2,
    status: "Đang bán",
    created_at: "2026-03-01T09:00:00",
    images: [
      {
        id: 1,
        url: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80",
        is_main: true,
      },
    ],
    variants: [
      {
        id: 1,
        sku: "RING-18K-001",
        size: "12",
        weight_modifier: 0.15,
        stock: {
          quantity: 21,
          warehouse_location: "WH-A1",
        },
      },
    ],
    pricing: {
      labor_cost: 850000,
      stone_cost: 450000,
      markup_rate: 0.18,
      current_sale_price_cache: 8900000,
    },
  },
  {
    id: 2,
    category_id: 9,
    name: "Dây chuyền bạc Italy",
    description:
      "Dây chuyền bạc phong cách tối giản, dễ phối với nhiều trang phục.",
    material_type: "Bạc 925",
    base_weight: 5.6,
    status: "Đang bán",
    created_at: "2026-03-03T14:20:00",
    images: [
      {
        id: 2,
        url: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80",
        is_main: true,
      },
    ],
    variants: [
      {
        id: 2,
        sku: "NECK-S925-010",
        size: "45cm",
        weight_modifier: 0.4,
        stock: {
          quantity: 35,
          warehouse_location: "WH-B2",
        },
      },
    ],
    pricing: {
      labor_cost: 250000,
      stone_cost: 0,
      markup_rate: 0.12,
      current_sale_price_cache: 2450000,
    },
  },
  {
    id: 3,
    category_id: 13,
    name: "Bông tai kim cương mini",
    description:
      "Mẫu bông tai nhỏ gọn, có giấy kiểm định và thiết kế hiện đại.",
    material_type: "Kim cương + vàng trắng",
    base_weight: 2.1,
    status: "Bản nháp",
    created_at: "2026-03-05T08:30:00",
    images: [
      {
        id: 3,
        url: "https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?auto=format&fit=crop&w=900&q=80",
        is_main: true,
      },
    ],
    variants: [
      {
        id: 3,
        sku: "EAR-DIA-015",
        size: "Free size",
        weight_modifier: 0.08,
        stock: {
          quantity: 12,
          warehouse_location: "WH-C1",
        },
      },
    ],
    pricing: {
      labor_cost: 1200000,
      stone_cost: 1800000,
      markup_rate: 0.22,
      current_sale_price_cache: 3200000,
    },
  },
];
