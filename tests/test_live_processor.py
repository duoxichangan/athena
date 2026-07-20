from live_processor import bbox_bottom_center


def test_bbox_bottom_center_normalizes_to_video_dimensions():
    assert bbox_bottom_center([100, 40, 300, 240], 400, 300) == (0.5, 0.8)


def test_bbox_bottom_center_clamps_out_of_range_values():
    assert bbox_bottom_center([-20, 0, 20, 400], 100, 200) == (0.0, 1.0)
