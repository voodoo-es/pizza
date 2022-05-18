odoo.define('pizza_modifiers.models', function(require) {
    "use strict";

    var models = require('point_of_sale.models');

    // Add field
    models.load_fields('product.attribute', 'value_ids');
    models.load_fields('product.template.attribute.value', 'name');
    models.load_fields(
        'product.product',
        ['valid_product_template_attribute_line_ids', 'product_template_attribute_value_ids',
            'is_modifier', 'open_popup', 'allow_portion',
        ]);
    //Add new models
    models.PosModel.prototype.models.push({
        model: 'product.template',
        fields: [
            'name',
            'display_name',
            'product_variant_ids',
            'product_variant_count',
            'modifier_ids',
            'is_modifier',
            'open_popup',
            'allow_portion',
            'apply_selector', 'min_selector', 'max_selector',
            'slice_product_ids',
        ],
        domain: function(self) {
            return [
                ['sale_ok', '=', true],
                ['available_in_pos', '=', true],
            ];
        },
        context: function(self) {
            return {
                display_default_code: false
            };
        },
        loaded: function(self, templates) {
            self.db.add_templates(templates);
        },
    }, {
        model: 'product.modifiers',
        fields: [
            'name', 'desc', 'price', 'product_id'
        ],
        loaded: function(self, modifiers) {
            self.db.add_modifiers(modifiers);
        },
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        add_product: function(product, options) {
            if (product && product.is_modifier) {
                options = _.extend({ merge: false }, options);
            }
            _super_order.add_product.call(this, product, options);
        },
        m_add_product: function(product, options) {
            if (this._printed) {
                this.destroy();
                return this.pos.get_order().add_product(product, options);
            }
            this.assert_editable();
            options = options || {};
            var line = new models.Orderline({}, { pos: this.pos, order: this, product: product });
            this.fix_tax_included_price(line);

            this.set_orderline_options(line, options);

            var to_merge_orderline;
            for (var i = 0; i < this.orderlines.length; i++) {
                if (this.orderlines.at(i).can_be_merged_with(line) && options.merge !== false) {
                    to_merge_orderline = this.orderlines.at(i);
                }
            }
            if (to_merge_orderline) {
                to_merge_orderline.merge(line);
            } else {
                this.orderlines.add(line);
            }

            if (options.draftPackLotLines) {
                this.selected_orderline.setPackLotLines(options.draftPackLotLines);
            }
            if (this.pos.config.iface_customer_facing_display) {
                this.pos.send_current_order_to_customer_facing_display();
            }
        },
        m_remove_orderline: function(line) {
            this.assert_editable();
            this.orderlines.remove(line);
        },
        get_orderlines: function() {
            let orderlines = this.orderlines.models;
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
            } else {
                sequenceOrderLine = [];
            }
            return sequenceOrderLine;
        },
    });
    var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr, options) {
            _super_orderline.initialize.call(this, attr, options);
            this.parent_line_id = this.parent_line_id || false;
            this.portion = this.portion || false;
        },
        set_parent_line_id: function(line_id) {
            this.parent_line_id = line_id;
            this.trigger('change', this);
        },
        get_parent_line_id: function() {
            return this.parent_line_id;
        },
        set_portion: function(portion) {
            this.portion = portion;
            this.trigger('change', this);
        },
        get_portion: function() {
            return this.portion;
        },
        clone: function() {
            var orderline = _super_orderline.clone.call(this);
            orderline.parent_line_id = this.parent_line_id;
            orderline.portion = this.portion;
            return orderline;
        },
        export_as_JSON: function() {
            var json = _super_orderline.export_as_JSON.call(this);
            json.parent_line_id = this.parent_line_id;
            json.portion = this.portion;
            return json;
        },
        init_from_JSON: function(json) {
            _super_orderline.init_from_JSON.apply(this, arguments);
            this.parent_line_id = json.parent_line_id;
            this.portion = json.portion;
        },
        export_for_printing: function() {
            var result = _super_orderline.export_for_printing.apply(this, arguments);
            result.parent_line_id = this.parent_line_id;
            result.portion = this.portion;
            return result;
        },
    });
});