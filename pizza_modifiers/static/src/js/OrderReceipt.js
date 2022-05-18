odoo.define('pizza_modifiers.OrderReceipt', function(require) {
    'use strict';

    const OrderReceipt = require('point_of_sale.OrderReceipt');
    const Registries = require('point_of_sale.Registries');

    const PizzaModifiersOrderReceipt = OrderReceipt =>
        class extends OrderReceipt {
            constructor() {
                super(...arguments);
            }
            get receipt() {
                let orderlines = this.receiptEnv.receipt.orderlines;
                var res = [];
                var order_line_ids = [];
                if (orderlines.length > 0) {
                    orderlines.forEach((e, i) => {
                        order_line_ids.push(e.id);
                    });
                    for (var i = 0, len = order_line_ids.length; i < len; i++) {
                        var found_ols = []
                        for (var k = 0, len = orderlines.length; k < len; k++) {
                            if (order_line_ids[i] === orderlines[k].parent_line_id) {
                                found_ols.push(orderlines[k]);
                            }
                        }
                        var id = parseInt(order_line_ids[i]);
                        res.push({ id, found_ols });
                    }
                    var sequenceOrderLine = [];
                    for (var k = 0, len = orderlines.length; k < len; k++) {
                        for (var j = 0, len = res.length; j < len; j++) {
                            if (res[j].id === orderlines[k].id && !orderlines[k].parent_line_id) {
                                sequenceOrderLine.push(orderlines[k]);
                                if (res[j].found_ols.length > 0) {
                                    var d = [];
                                    let x = res[j].found_ols;
                                    x.forEach((e, i) => {
                                        if (!(e.id in d)) {
                                            d.push(e.id);
                                            sequenceOrderLine.push(e);
                                        }
                                    });
                                }
                            }
                        }
                    }
                    this.receiptEnv.receipt.orderlines = sequenceOrderLine;
                }
                return this.receiptEnv.receipt;
            }

        };

    Registries.Component.extend(OrderReceipt, PizzaModifiersOrderReceipt);

    return OrderReceipt;
});